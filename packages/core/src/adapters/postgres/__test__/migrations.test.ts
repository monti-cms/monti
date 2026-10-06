import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf } from "../../../../test/stored-content";
import { seedEntry } from "../../../core/store/__test__/seed";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { pluginDatabaseFor } from "../adapter";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Migration step records, the concurrent-run lock, schema creation, and run-once jobs. */
describe("migrations", () => {
	let pool: Pool;
	let schemaName: string;
	/** Schemas created separately by the test (dropped afterward). */
	const extraSchemas: string[] = [];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		for (const schema of extraSchemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const applied = async (schema: string) =>
		(await pool.query<{ name: string }>(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows.map(
			(row) => row.name,
		);

	it("runs one at a time even when started twice concurrently, and records every step once", async () => {
		await Promise.all([
			migrateContentStore(pool, { schema: schemaName }),
			migrateContentStore(pool, { schema: schemaName }),
		]);
		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		// Running again does nothing.
		await migrateContentStore(pool, { schema: schemaName });
		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
	});

	it("creates the schema if missing (only set `schema` and run monti migrate)", async () => {
		const schema = `cms_test_new_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { schema });
		const tables = await pool.query(
			`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'entries'`,
			[schema],
		);
		expect(tables.rows).toHaveLength(1);
	});

	it("leaves data intact and records every step even for a legacy store with no step record", async () => {
		const store = createContentStore(pool, { schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "kept",
			metadata: { title: "Kept" },
			mdx: "본문",
		});
		// A store from before step records existed: it has only the one-off record (initial templates).
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name <> 'seed_initial_body_templates'`);
		await pool.query(`DELETE FROM "${schemaName}".body_templates`);

		await migrateContentStore(pool, { schema: schemaName });

		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		// The step that stores documents writes the body from its document (it adds the closing line break) and gives it one.
		const migrated = (await store.getEntry(entry.id)).working;
		expect(migrated.mdx).toBe("본문\n");
		expect(contentOf(migrated.doc)).toEqual(contentOf(bodyFromMdx("본문").doc));
		// Initial templates that were already inserted are not revived after being deleted.
		expect((await pool.query(`SELECT 1 FROM "${schemaName}".body_templates`)).rows).toHaveLength(0);
	});

	it("runs a plugin's run-once job only once even when called concurrently, and records nothing on failure", async () => {
		const db = pluginDatabaseFor(pool, schemaName);
		let runs = 0;
		const results = await Promise.all(
			[1, 2, 3].map(() =>
				db.once("test:count", async (client) => {
					runs += 1;
					await client.query("SELECT 1");
				}),
			),
		);
		expect(runs).toBe(1);
		expect(results.filter(Boolean)).toHaveLength(1);

		await expect(
			db.once("test:fails", async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		expect(await applied(schemaName)).not.toContain("test:fails");
		expect(await db.once("test:fails", async () => {})).toBe(true);
	});
});

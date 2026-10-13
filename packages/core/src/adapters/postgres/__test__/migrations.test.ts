import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import { SetupError } from "../../../core/problem";
import { seedEntry } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../migrations";
import { createPluginStorage } from "../plugin-storage";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The migration runner: step records, the concurrent-run lock, schema creation, the seed job and run-once jobs. */
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

	it("has exactly the baseline as its step list (a guard against renaming a step)", () => {
		expect([...CONTENT_STORE_MIGRATIONS]).toEqual(["0001_baseline"]);
	});

	it("runs one at a time even when started twice concurrently, and records the steps and the seed once", async () => {
		await Promise.all([
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
		]);
		const expected = [...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates"].sort();
		expect(await applied(schemaName)).toEqual(expected);
	});

	it("is a no-op when run again", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const before = await applied(schemaName);
		const again = await migrateContentStore(pool, { site: testSite, schema: schemaName });
		expect(again).toEqual({ applied: 0, upToDate: CONTENT_STORE_MIGRATIONS.length });
		expect(await applied(schemaName)).toEqual(before);
	});

	it("creates no MDX text columns, and a normal write stores the document only", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const columns = await pool.query(
			`SELECT 1 FROM information_schema.columns
			 WHERE table_schema = $1 AND column_name = 'mdx' AND table_name IN ('entry_bodies', 'body_templates')`,
			[schemaName],
		);
		expect(columns.rows).toHaveLength(0);

		const store = createContentStore(pool, { site: testSite, schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "doc-only",
			metadata: { title: "Doc only" },
			text: "words",
		});
		expect(contentOf((await store.getEntry(entry.id)).working.doc)).toEqual(contentOf(docOf("words")));
		const template = await store.createTemplate({ name: "Doc only template", doc: docOf("template words") });
		expect((await store.getTemplate(template.id)).doc).toBeDefined();
	});

	it("seeds the initial body templates once, and does not revive a deleted one", async () => {
		const seeded = testSite.config.seed?.templates ?? [];
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const count = async () =>
			Number((await pool.query(`SELECT count(*) AS count FROM "${schemaName}".body_templates`)).rows[0].count);
		expect(await count()).toBeGreaterThanOrEqual(seeded.length);
		await pool.query(`DELETE FROM "${schemaName}".body_templates`);
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		expect(await count()).toBe(0);
	});

	it("refuses a database built from the numbered steps of an older pre-release, and changes nothing", async () => {
		const schema = `cms_test_old_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { site: testSite, schema });
		await pool.query(`INSERT INTO "${schema}".cms_migrations (name) VALUES ('0001_tables'), ('0023_entry_changed_by')`);
		const error = await migrateContentStore(pool, { site: testSite, schema }).then(
			() => undefined,
			(caught: unknown) => caught as SetupError,
		);
		expect(error).toBeInstanceOf(SetupError);
		expect(error?.kind).toBe("database_outdated");
		expect(error?.message).toContain("created by an older pre-release of Monti and cannot be upgraded");
		expect(error?.message).toContain("Fix: recreate it (run db:setup on a fresh schema or an empty database)");
		expect(await applied(schema)).toEqual(
			[...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates", "0001_tables", "0023_entry_changed_by"].sort(),
		);
	});

	it("creates the schema if missing (only set `schema` and run monti db:migrate)", async () => {
		const schema = `cms_test_new_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { site: testSite, schema });
		const tables = await pool.query(
			`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'entries'`,
			[schema],
		);
		expect(tables.rows).toHaveLength(1);
	});

	it("records a plugin's one-time step in the core migration log, under the plugin's name", async () => {
		const storage = createPluginStorage(pool, schemaName, "logged");
		expect(await storage.once("first-step", async () => {})).toBe(true);
		expect(await applied(schemaName)).toContain("plugin:logged:first-step");
		// Another plugin's step of the same name is a different step.
		expect(await createPluginStorage(pool, schemaName, "other").once("first-step", async () => {})).toBe(true);
		expect(await storage.once("first-step", async () => {})).toBe(false);
	});
});

import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentCollection } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { SetupError } from "../../../core/problem";
import { seedEntry } from "../../../core/store/__test__/seed";
import { documentKeyHash } from "../../../core/translation/state-hash";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../migrations";
import { fillDocumentHashes } from "../migrations/0003_translation_source_hashes";
import { createPluginStorage } from "../plugin-storage";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The migration runner: step records, the concurrent-run lock, schema creation, the seed job and run-once jobs. */
describe("migrations", () => {
	let pool: Pool;
	let schemaName: string;
	/** Schemas created separately by the test (dropped afterward). */
	const extraSchemas: string[] = [];

	/** Each test starts from an empty schema of its own, with no step recorded. */
	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterEach(async () => {
		for (const schema of extraSchemas.splice(0)) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	const applied = async (schema: string) =>
		(await pool.query<{ name: string }>(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows.map(
			(row) => row.name,
		);

	it("DB-M4 fills the hashes the translation filter compares for bodies written before they were kept, and every new body has them", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const store = createContentStore(pool, { site: testSite, schema: schemaName });
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "hash-fill",
			metadata: { title: "해시" },
			text: "본문",
			contentHash: "hash-fill-1",
		});
		const read = async () =>
			(
				await pool.query<{ doc_key_hash: string | null; translation_base_hash: string | null; doc: unknown }>(
					`SELECT doc_key_hash, translation_base_hash, doc FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[entry.id],
				)
			).rows[0];
		const written = await read();
		expect(written?.doc_key_hash).toBe(documentKeyHash(entry.working.doc));
		// A source has no base to compare.
		expect(written?.translation_base_hash).toBeNull();
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc_key_hash = NULL WHERE entry_id = $1`, [entry.id]);
		const client = await pool.connect();
		try {
			expect(await fillDocumentHashes(client, schemaName)).toBeGreaterThanOrEqual(1);
		} finally {
			client.release();
		}
		expect((await read())?.doc_key_hash).toBe(documentKeyHash(entry.working.doc));
	});

	it("DB-M3 runs one at a time even when started twice concurrently, and records the steps and the seed once", async () => {
		await Promise.all([
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
		]);
		const expected = [...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates"].sort();
		expect(await applied(schemaName)).toEqual(expected);
	});

	it("DB-M3 is a no-op when run again", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const before = await applied(schemaName);
		const again = await migrateContentStore(pool, { site: testSite, schema: schemaName });
		expect(again).toEqual({ applied: 0, upToDate: CONTENT_STORE_MIGRATIONS.length });
		expect(await applied(schemaName)).toEqual(before);
	});

	it("DB-M5 refuses a database built from the numbered steps of an older pre-release, and changes nothing", async () => {
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

	it("DB-M6 creates the schema if missing (only set `schema` and run monti db:migrate)", async () => {
		const schema = `cms_test_new_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { site: testSite, schema });
		const tables = await pool.query(
			`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'entries'`,
			[schema],
		);
		expect(tables.rows).toHaveLength(1);
	});

	it("PLUG-S8 records a plugin's one-time step in the core migration log, under the plugin's name", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const storage = createPluginStorage(pool, schemaName, "logged");
		expect(await storage.once("first-step", async () => {})).toBe(true);
		expect(await applied(schemaName)).toContain("plugin:logged:first-step");
		// Another plugin's step of the same name is a different step.
		expect(await createPluginStorage(pool, schemaName, "other").once("first-step", async () => {})).toBe(true);
		expect(await storage.once("first-step", async () => {})).toBe(false);
	});
});

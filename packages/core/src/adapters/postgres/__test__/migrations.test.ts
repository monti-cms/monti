import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../../test/stored-content";
import { seedEntry } from "../../../core/store/__test__/seed";
import { createContentStore, migrateContentStore } from "../content-store";
import { createPluginStorage } from "../plugin-storage";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { fakeMdxRegistry } from "./fake-mdx-format";
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

	it("runs the step that makes the MDX text columns optional after the document steps, and the one-time seed last", () => {
		const order = (name: string) => CONTENT_STORE_MIGRATIONS.indexOf(name);
		expect(order("0020_mdx_columns_optional")).toBeGreaterThan(order("0019_templates_documents"));
		expect(order("seed_initial_body_templates")).toBe(CONTENT_STORE_MIGRATIONS.length - 1);
		expect(order("0020_mdx_columns_optional")).toBeLessThan(order("seed_initial_body_templates"));
	});

	it("leaves the MDX text columns of bodies and templates optional, and a normal write does not fill them", async () => {
		await migrateContentStore(pool, { schema: schemaName });
		const nullable = await pool.query<{ table_name: string; is_nullable: string }>(
			`SELECT table_name, is_nullable FROM information_schema.columns
			 WHERE table_schema = $1 AND column_name = 'mdx' AND table_name IN ('entry_bodies', 'body_templates')`,
			[schemaName],
		);
		expect(nullable.rows.map((row) => row.table_name).sort()).toEqual(["body_templates", "entry_bodies"]);
		for (const row of nullable.rows) expect(row.is_nullable, row.table_name).toBe("YES");

		const store = createContentStore(pool, { schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "no-text",
			metadata: { title: "No text" },
			text: "words",
		});
		const bodies = await pool.query<{ mdx: string | null }>(
			`SELECT mdx FROM "${schemaName}".entry_bodies WHERE entry_id = $1`,
			[entry.id],
		);
		expect(bodies.rows.length).toBeGreaterThan(0);
		for (const row of bodies.rows) expect(row.mdx).toBeNull();

		const template = await store.createTemplate({ name: "No text template", doc: docOf("template words") });
		const templates = await pool.query<{ mdx: string | null }>(
			`SELECT mdx FROM "${schemaName}".body_templates WHERE id = $1`,
			[template.id],
		);
		expect(templates.rows).toHaveLength(1);
		expect(templates.rows[0]?.mdx).toBeNull();
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
			text: "본문",
		});
		// A store from before step records existed: it has only the one-off record (initial templates), and its bodies are text (the text a save wrote then).
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name <> 'seed_initial_body_templates'`);
		await pool.query(`DELETE FROM "${schemaName}".body_templates`);
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = '본문' WHERE entry_id = $1`, [entry.id]);
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = '' WHERE mdx IS NULL`);
		// Its old steps read the text with the old-body reader of the MDX format (a test double stands for it here).
		const { formats } = fakeMdxRegistry();

		await migrateContentStore(pool, { schema: schemaName, formats });

		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		// The steps of that time give the text its document, with the content it had.
		const migrated = (await store.getEntry(entry.id)).working;
		expect(contentOf(migrated.doc)).toEqual(contentOf(docOf("본문")));
		expect(await store.getEntry(entry.id)).toMatchObject({ version: entry.version });
		// Initial templates that were already inserted are not revived after being deleted.
		expect((await pool.query(`SELECT 1 FROM "${schemaName}".body_templates`)).rows).toHaveLength(0);
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

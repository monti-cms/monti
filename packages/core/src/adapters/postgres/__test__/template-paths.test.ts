import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { readStoredDocument } from "../../../doc/stored-document";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../migrations";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const SEEDED = testSite.config.seed?.templates ?? [];

/** The two real paths templates take through migration, with nothing deleted or prepared by hand. */
describe("templates through migration", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it.skipIf(SEEDED.length === 0)(
		"a fresh install seeds doc-only templates after the steps, and running everything again changes nothing",
		async () => {
			await migrateContentStore(pool, { site: testSite, schema: schemaName });

			const applied = (await pool.query<{ name: string }>(`SELECT name FROM "${schemaName}".cms_migrations`)).rows;
			expect(applied.map((row) => row.name).sort()).toEqual(
				[...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates"].sort(),
			);
			const store = createContentStore(pool, { site: testSite, schema: schemaName });
			const templates = await store.listTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(SEEDED.length);
			for (const template of templates) {
				expect(readStoredDocument(template.doc, testSite)).toBeDefined();
			}

			// Running everything again changes nothing.
			const before = (await pool.query(`SELECT id, doc, version FROM "${schemaName}".body_templates ORDER BY id`)).rows;
			await migrateContentStore(pool, { site: testSite, schema: schemaName });
			const after = (await pool.query(`SELECT id, doc, version FROM "${schemaName}".body_templates ORDER BY id`)).rows;
			expect(after).toEqual(before);
		},
	);
});

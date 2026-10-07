import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import type { ContentStore } from "../../../core/store";
import { createContentStore, migrateContentStore } from "../content-store";
import { templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The site config's initial body templates (`seed.templates`). For a config without any, the seeding tests are skipped. */
const SEEDED = testSite.config.seed?.templates ?? [];

describe("Body templates: seeding and migration in Postgres", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	// To check that deleting one leaves the other intact, there must be at least two templates.
	it.skipIf(SEEDED.length < 2)(
		"1. seeds templates for both editor types without reviving deleted templates",
		async () => {
			const templates = await store.listTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(SEEDED.length);

			// The config's templates are inserted with their name and their document: a seed written as text is read by its format, and nothing is written
			// to the text column.
			for (const seed of SEEDED) {
				const found = templates.find((t) => t.name === seed.name);
				if (!found) throw new Error(`Template not found: ${seed.name}`);
				// The core test config writes its seeds as documents, so no format is needed to read them.
				expect(seed.doc).toBeDefined();
				expect(contentOf(found.doc)).toEqual(contentOf(seed.doc));
				expect(await templateMdx(pool, schemaName, found.id)).toBeNull();
			}
			const [first, second] = SEEDED.map((seed) => templates.find((t) => t.name === seed.name));
			if (!first || !second) throw new Error("Seed templates not found.");

			// Delete one template
			await store.deleteTemplate({ id: first.id, expectedVersion: first.version });

			// Re-run migration
			await migrateContentStore(pool, { site: testSite, schema: schemaName });

			// Verify deleted template did NOT resurrect (one-time seed guarantee)
			const remaining = await store.listTemplates();
			expect(remaining.find((t) => t.id === first.id)).toBeUndefined();
			expect(remaining.find((t) => t.id === second.id)).toBeDefined();
		},
	);

	it.skipIf(SEEDED.length === 0)("seed preserves same-name user templates and never resurrects deletions", async () => {
		// Test 1 deleted the first template, so use the last template.
		const name = SEEDED[SEEDED.length - 1]?.name;
		const seeded = (await store.listTemplates()).find((template) => template.name === name);
		if (!seeded) throw new Error(`Template not found: ${name}`);

		const userId = randomUUID();
		await pool.query(`UPDATE "${schemaName}".body_templates SET id = $1, doc = $2::jsonb WHERE id = $3`, [
			userId,
			JSON.stringify(docOf("사용자가 수정한 본문")),
			seeded.id,
		]);
		// Even if the seed marker is cleared so seeding runs again, a user template with the same name is not overwritten.
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'seed_initial_body_templates'`);
		await migrateContentStore(pool, { site: testSite, schema: schemaName });

		const preserved = (await store.listTemplates()).filter((template) => template.name === name);
		expect(preserved).toHaveLength(1);
		expect(preserved[0]).toMatchObject({ id: userId });
		expect(contentOf(preserved[0]?.doc)).toEqual(contentOf(docOf("사용자가 수정한 본문")));

		await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		expect((await store.listTemplates()).some((template) => template.name === name)).toBe(false);
	});
});

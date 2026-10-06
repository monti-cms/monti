import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../../test/stored-content";
import { cmsConfig } from "../../../config/resolved";
import type { ContentStore } from "../../../core/store";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { createContentStore, migrateContentStore } from "../content-store";
import { templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The site config's initial body templates (`seed.templates`). For a config without any, the seeding tests are skipped. */
const SEEDED = cmsConfig.seed?.templates ?? [];

describe("Body templates: seeding and migration in Postgres", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
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
				const expected = seed.doc ?? bodyFromMdx(seed.body ?? "").doc;
				expect(expected).not.toBeNull();
				expect(contentOf(found.doc)).toEqual(contentOf(expected));
				expect(await templateMdx(pool, schemaName, found.id)).toBeNull();
			}
			const [first, second] = SEEDED.map((seed) => templates.find((t) => t.name === seed.name));
			if (!first || !second) throw new Error("Seed templates not found.");

			// Delete one template
			await store.deleteTemplate({ id: first.id, expectedVersion: first.version });

			// Re-run migration
			await migrateContentStore(pool, { schema: schemaName });

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
		await migrateContentStore(pool, { schema: schemaName });

		const preserved = (await store.listTemplates()).filter((template) => template.name === name);
		expect(preserved).toHaveLength(1);
		expect(preserved[0]).toMatchObject({ id: userId });
		expect(contentOf(preserved[0]?.doc)).toEqual(contentOf(docOf("사용자가 수정한 본문")));

		await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
		await migrateContentStore(pool, { schema: schemaName });
		expect((await store.listTemplates()).some((template) => template.name === name)).toBe(false);
	});

	it("merges legacy collection templates and preserves same-name content", async () => {
		const legacy = await createIsolatedTestPool();
		try {
			await legacy.pool.query(`
				CREATE TABLE "${legacy.schemaName}".body_templates (
					id UUID PRIMARY KEY,
					name TEXT NOT NULL,
					for_collection TEXT NOT NULL CHECK (for_collection IN ('post', 'memo')),
					mdx TEXT NOT NULL,
					version INTEGER NOT NULL DEFAULT 1,
					created_at TIMESTAMPTZ NOT NULL,
					updated_at TIMESTAMPTZ NOT NULL
				);
				CREATE UNIQUE INDEX body_templates_collection_name_idx
				ON "${legacy.schemaName}".body_templates (for_collection, lower(name));
			`);
			const memoId = randomUUID();
			const postId = randomUUID();
			await legacy.pool.query(
				`INSERT INTO "${legacy.schemaName}".body_templates
				 (id, name, for_collection, mdx, version, created_at, updated_at)
				 VALUES ($1, '공통 이름', 'memo', '메모 본문', 3, '2026-01-01', '2026-01-02'),
				        ($2, '공통 이름', 'post', '포스트 본문', 5, '2026-02-01', '2026-02-02')`,
				[memoId, postId],
			);

			await migrateContentStore(legacy.pool, { schema: legacy.schemaName });
			const mergedStore = createContentStore(legacy.pool, { schema: legacy.schemaName });
			const merged = await mergedStore.listTemplates();
			// The bodies are stored written from their documents (with a closing line break), and keep their versions.
			const memo = merged.find((template) => template.id === memoId);
			const post = merged.find((template) => template.id === postId);
			expect(memo).toMatchObject({ name: "공통 이름", version: 3 });
			expect(post).toMatchObject({ version: 5 });
			// Migration 0013 wrote their text from the documents it gave them; 0019 leaves the column as it is.
			expect(await templateMdx(pool, legacy.schemaName, memoId)).toBe("메모 본문\n");
			expect(await templateMdx(pool, legacy.schemaName, postId)).toBe("포스트 본문\n");
			expect(contentOf(memo?.doc)).toEqual(contentOf(bodyFromMdx("메모 본문").doc));
			expect(contentOf(post?.doc)).toEqual(contentOf(bodyFromMdx("포스트 본문").doc));
			expect(merged.find((template) => template.id === postId)?.name).not.toBe("공통 이름");
			expect(new Set(merged.map((template) => template.name.toLowerCase())).size).toBe(merged.length);

			await migrateContentStore(legacy.pool, { schema: legacy.schemaName });
			expect(await mergedStore.listTemplates()).toEqual(merged);
			const column = await legacy.pool.query(
				`SELECT 1 FROM information_schema.columns
				 WHERE table_schema = $1 AND table_name = 'body_templates' AND column_name = 'for_collection'`,
				[legacy.schemaName],
			);
			expect(column.rowCount).toBe(0);
		} finally {
			await dropIsolatedTestPool(legacy.pool, legacy.schemaName);
		}
	});
});

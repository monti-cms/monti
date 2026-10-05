import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf } from "../../../../test/stored-content";
import { cmsConfig } from "../../../config/resolved";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { type ContentStore, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The site config's initial body templates (`seed.templates`). For a config without any, the seeding tests are skipped. */
const SEEDED = cmsConfig.seed?.templates ?? [];

describe("Body Templates Store Contract", () => {
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

			// The config's templates are inserted with their name, and their body as it is stored: written from its document, which is stored with it.
			for (const seed of SEEDED) {
				const found = templates.find((t) => t.name === seed.name);
				if (!found) throw new Error(`Template not found: ${seed.name}`);
				const stored = bodyFromMdx(seed.mdx);
				expect(stored.doc).not.toBeNull();
				expect(found.mdx).toBe(stored.mdx);
				expect(contentOf(found.doc)).toEqual(contentOf(stored.doc));
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
		await pool.query(`UPDATE "${schemaName}".body_templates SET id = $1, mdx = $2 WHERE id = $3`, [
			userId,
			"사용자가 수정한 본문",
			seeded.id,
		]);
		// Even if the seed marker is cleared so seeding runs again, a user template with the same name is not overwritten.
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'seed_initial_body_templates'`);
		await migrateContentStore(pool, { schema: schemaName });

		const preserved = (await store.listTemplates()).filter((template) => template.name === name);
		expect(preserved).toHaveLength(1);
		expect(preserved[0]).toMatchObject({ id: userId, mdx: "사용자가 수정한 본문" });

		await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
		await migrateContentStore(pool, { schema: schemaName });
		expect((await store.listTemplates()).some((template) => template.name === name)).toBe(false);
	});

	it("stores a template as its document and the MDX written from it, on create and on update", async () => {
		const created = await store.createTemplate({
			name: "doc template",
			mdx: "Title\n=====\n\nSome _words_\n\n\n* one\n",
		});
		const expected = bodyFromMdx("Title\n=====\n\nSome _words_\n\n\n* one\n");
		expect(expected.doc).not.toBeNull();
		expect(created.mdx).toBe("# Title\n\nSome *words*\n\n- one\n");
		expect(contentOf(created.doc)).toEqual(contentOf(expected.doc));
		// Read back through the store (and the database) it is the same document, ids included.
		expect((await store.getTemplate(created.id)).doc).toEqual(created.doc);

		const updated = await store.updateTemplate({ id: created.id, expectedVersion: created.version, mdx: "## Other\n" });
		expect(contentOf(updated.doc)).toEqual(contentOf(bodyFromMdx("## Other\n").doc));
		expect(updated.mdx).toBe("## Other\n");

		// A rename keeps the body and its document as they are.
		const renamed = await store.updateTemplate({
			id: created.id,
			expectedVersion: updated.version,
			name: "doc template 2",
		});
		expect(renamed.mdx).toBe(updated.mdx);
		expect(renamed.doc).toEqual(updated.doc);
	});

	it("stores a template that does not parse as given, without a document", async () => {
		const created = await store.createTemplate({ name: "broken template", mdx: "Words\n\n<Unclosed" });
		expect(created.mdx).toBe("Words\n\n<Unclosed");
		expect(created.doc).toBeNull();
		const updated = await store.updateTemplate({ id: created.id, expectedVersion: created.version, mdx: "Fixed\n" });
		expect(contentOf(updated.doc)).toEqual(contentOf(bodyFromMdx("Fixed\n").doc));
		const broken = await store.updateTemplate({ id: created.id, expectedVersion: updated.version, mdx: "<Open" });
		expect(broken.doc).toBeNull();
		expect(broken.mdx).toBe("<Open");
	});

	it("2. supports CRUD with optimistic concurrency (version checking)", async () => {
		// Create
		const created = await store.createTemplate({
			name: "새 포스트 템플릿",
			mdx: "## 개요\n\n내용 작성",
		});
		expect(created.id).toBeDefined();
		expect(created.version).toBe(1);
		expect(created.name).toBe("새 포스트 템플릿");

		// Read by id
		const fetched = await store.getTemplate(created.id);
		expect(fetched.name).toBe("새 포스트 템플릿");

		const allTemplates = await store.listTemplates();
		expect(allTemplates.some((t) => t.id === created.id)).toBe(true);

		// Update with correct expectedVersion
		const updated = await store.updateTemplate({
			id: created.id,
			expectedVersion: 1,
			mdx: "## 개요 (수정됨)\n\n내용 작성",
		});
		expect(updated.version).toBe(2);
		expect(updated.mdx).toContain("## 개요 (수정됨)");

		// Update with stale expectedVersion throws conflict
		await expect(
			store.updateTemplate({
				id: created.id,
				expectedVersion: 1,
				mdx: "conflict!",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));

		// Names are unique across the unified template list.
		await expect(
			store.createTemplate({
				name: "새 포스트 템플릿",
				mdx: "duplicate name",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));
		await store.createTemplate({ name: "CASE TEST", mdx: "original" });
		await expect(store.createTemplate({ name: "case test", mdx: "duplicate" })).rejects.toThrowError(
			expect.objectContaining({ code: "conflict" }),
		);

		// Delete with stale version throws conflict
		await expect(store.deleteTemplate({ id: created.id, expectedVersion: 1 })).rejects.toThrowError(
			expect.objectContaining({ code: "conflict" }),
		);

		// Delete succeeds with current version
		await store.deleteTemplate({ id: created.id, expectedVersion: 2 });
		await expect(store.getTemplate(created.id)).rejects.toThrowError(expect.objectContaining({ code: "not_found" }));
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
			expect(memo).toMatchObject({ name: "공통 이름", mdx: "메모 본문\n", version: 3 });
			expect(post).toMatchObject({ mdx: "포스트 본문\n", version: 5 });
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

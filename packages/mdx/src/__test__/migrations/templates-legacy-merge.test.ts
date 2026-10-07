import { randomUUID } from "node:crypto";
import { createFormatRegistry } from "@monti-cms/core/format";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "@monti-cms/core/testing";
import { afterAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { contentOf } from "../../../../core/test/stored-content";
import { bodyFromMdx } from "../../body";
import { createServerMdxFormat } from "../../server";

/** The `mdx` format as a server registers it: it also reads the text of old bodies, which the migration steps under test need. */
const formats = createFormatRegistry([createServerMdxFormat()]);

afterAll(closeGlobalPool);

describe("body templates of a store that kept them as MDX text", () => {
	it("merges legacy collection templates and preserves same-name content", async () => {
		const legacy = await createIsolatedTestPool();
		const textOf = async (id: string) =>
			(
				await legacy.pool.query<{ mdx: string | null }>(
					`SELECT mdx FROM "${legacy.schemaName}".body_templates WHERE id = $1`,
					[id],
				)
			).rows[0]?.mdx ?? null;
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

			await migrateContentStore(legacy.pool, { site: testSite, schema: legacy.schemaName, formats });
			const mergedStore = createContentStore(legacy.pool, { site: testSite, schema: legacy.schemaName });
			const merged = await mergedStore.listTemplates();
			// The bodies are stored written from their documents (with a closing line break), and keep their versions.
			const memo = merged.find((template) => template.id === memoId);
			const post = merged.find((template) => template.id === postId);
			expect(memo).toMatchObject({ name: "공통 이름", version: 3 });
			expect(post).toMatchObject({ version: 5 });
			// Migration 0013 wrote their text from the documents it gave them; 0019 leaves the column as it is.
			expect(await textOf(memoId)).toBe("메모 본문\n");
			expect(await textOf(postId)).toBe("포스트 본문\n");
			expect(contentOf(memo?.doc)).toEqual(contentOf(bodyFromMdx(testSite, "메모 본문").doc));
			expect(contentOf(post?.doc)).toEqual(contentOf(bodyFromMdx(testSite, "포스트 본문").doc));
			expect(merged.find((template) => template.id === postId)?.name).not.toBe("공통 이름");
			expect(new Set(merged.map((template) => template.name.toLowerCase())).size).toBe(merged.length);

			await migrateContentStore(legacy.pool, { site: testSite, schema: legacy.schemaName, formats });
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

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, titleFieldOf } from "../../../../test/any-site";
import { type Collection, isItemCollection } from "../../../core/collections";
import { storedFields } from "../../../schema/derive";
import { createContentStore, migrateContentStore } from "../content-store";
import { seedEntry } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M5-BE-1 Duplicate Entry Contract", () => {
	let pool: Pool;
	let schemaName: string;
	let store: any;
	let relationTarget: (to: Collection) => Promise<string>;

	/** 항목 컬렉션을 가리키는 관계 필드마다 공개 항목 하나를 고른 값(블로그의 카테고리·태그 같은 것). */
	const itemRelationValues = async () => {
		const values: Record<string, string | string[]> = {};
		for (const { name, field, when } of storedFields(contentCollection)) {
			if (when || field.kind !== "relation" || !isItemCollection(field.to)) continue;
			const id = await relationTarget(field.to as Collection);
			values[name] = field.many ? [id] : id;
		}
		return values;
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		relationTarget = fillRequiredMetadata(store).relationTarget;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("duplicates entry draft with the caller's title, empty slug, draft status, and preserved references", async () => {
		const media = await store.createMediaAsset({
			filename: "sample.png",
			mimeType: "image/png",
			byteSize: 1024,
			width: 100,
			height: 100,
			stagingKey: "staging/sample.png",
		});
		const mediaId = media.id;
		const folder = await store.createFolder({ collection: contentCollection, name: "Tech" });
		const relations = await itemRelationValues();
		expect(Object.keys(relations).length).toBeGreaterThan(0);

		// Seed a published entry with folder and working references
		const original = await store.createEntryWithReferences({
			snapshot: {
				collection: contentCollection,
				slug: "orig-slug",
				metadata: { title: "Original Post", ...relations },
				mdx: "Hello world ![img](mediaId)",
				schemaVersion: 1,
				contentHash: "hash-orig",
				issues: [],
			},
			references: [
				{
					kind: "media",
					targetId: mediaId,
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 13 }],
				},
			],
			folderId: folder.id,
		});

		// Publish original so it has published body/status
		await store.publishEntry({ id: original.id, expectedVersion: original.version });
		const publishedOrig = await store.getEntry(original.id);
		expect(publishedOrig.status).toBe("published");
		expect(publishedOrig.publishedSlug).toBe("orig-slug");

		// Execute duplicate
		// 붙일 말은 부르는 쪽(관리자 화면)이 정한다. 저장소는 받은 제목을 그대로 저장한다.
		const duplicated = await store.duplicateEntry({ id: original.id, title: "Original Post (copy)" });

		// 1. Different ID, version 1, draft status
		expect(duplicated.id).toBeDefined();
		expect(duplicated.id).not.toBe(original.id);
		expect(duplicated.version).toBe(1);
		expect(duplicated.status).toBe("draft");

		// 2. Title is what the caller gave, slug is null/empty
		expect(duplicated.working.metadata.title).toBe("Original Post (copy)");
		expect(duplicated.workingSlug).toBeNull();
		expect(duplicated.publishedSlug).toBeNull();
		expect(duplicated.published).toBeUndefined();

		// 3. Same folder preserved (verified in entries table)
		const dbRow = await pool.query<{ folder_id: string | null }>(
			`SELECT folder_id FROM "${schemaName}".entries WHERE id = $1`,
			[duplicated.id],
		);
		expect(dbRow.rows[0].folder_id).toBe(folder.id);

		// 4. Working references preserved (media reuse without re-upload)
		const refs = await store.getWorkingReferences({ entryId: duplicated.id });
		expect(refs).toHaveLength(1);
		expect(refs[0].kind).toBe("media");
		expect(refs[0].targetId).toBe(mediaId);

		// 5. MDX and relation metadata(블로그의 카테고리·태그) preserved
		expect(duplicated.working.mdx).toBe("Hello world ![img](mediaId)");
		for (const [name, value] of Object.entries(relations)) {
			expect(duplicated.working.metadata[name]).toEqual(value);
		}
		expect(duplicated.working.metadata).toEqual({ ...publishedOrig.working.metadata, title: "Original Post (copy)" });
	});

	it("keeps the original title when no title is given, and checks the title field's max", async () => {
		const original = await seedEntry(store, {
			collection: contentCollection,
			slug: "keep-title",
			metadata: { title: "Same title" },
			mdx: "",
			schemaVersion: 1,
			contentHash: randomUUID(),
		});
		const copy = await store.duplicateEntry({ id: original.id });
		expect(copy.working.metadata.title).toBe("Same title");
		// 제목 필드의 `max`(설정마다 다르다)를 넘으면 필드 이름표와 경로를 담은 일반 오류다.
		const { max, label } = titleFieldOf(contentCollection);
		if (max === undefined) return;
		await expect(store.duplicateEntry({ id: original.id, title: "가".repeat(max + 1) })).rejects.toMatchObject({
			code: "field_too_long",
			issues: [{ code: "field_too_long", path: "title", message: label }],
		});
	});

	it("throws not_found when duplicating non-existent entry", async () => {
		const ghostId = randomUUID();
		await expect(store.duplicateEntry({ id: ghostId })).rejects.toThrowError(
			expect.objectContaining({ code: "not_found" }),
		);
	});
});

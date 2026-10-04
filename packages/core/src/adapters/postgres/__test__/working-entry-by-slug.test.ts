import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	otherContentCollection,
	recordCollection,
	requiredMetadata,
} from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * M9-FE-1: 관리자 미리보기 전용 working slug 조회.
 *
 * 공개 조회(`getPublishedEntryBySlug`)는 초안을 절대 반환하지 않는다. 그 계약을 건드리지 않고
 * 관리자 경로만 초안을 찾을 수 있는지 고정한다.
 */
describe("M9-FE-1 getWorkingEntryBySlug", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let relationTarget: (to: Collection) => Promise<string>;
	/** 같은 slug를 넣어 볼 다른 컬렉션(블로그는 메모). 문서 컬렉션이 하나뿐인 설정은 항목 컬렉션을 쓴다. */
	const elsewhere = otherContentCollection ?? recordCollection;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// 발행 필수값(블로그의 카테고리 같은 것)은 설정에서 찾아 채운다.
		relationTarget = fillRequiredMetadata(store).relationTarget;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function seedDraft(slug: string, mdx: string, metadata: Record<string, unknown> = { title: slug }) {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: null,
			metadata,
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}`,
		});

		return await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			slug,
			metadata,
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}-saved`,
		});
	}

	it("초안을 working 본문과 함께 돌려준다 — 공개 조회는 같은 slug를 못 본다", async () => {
		await seedDraft("draft-only-post", "초안 본문");

		const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "draft-only-post" });

		expect(found?.status).toBe("draft");
		expect(found?.workingSlug).toBe("draft-only-post");
		expect(found?.working.mdx).toBe("초안 본문");
		expect(found?.working.metadata).toEqual(
			await requiredMetadata(contentCollection, "draft-only-post", relationTarget),
		);

		// 공개 경로는 여전히 초안을 반환하지 않는다(이 변경으로 공개 계약이 넓어지지 않았다).
		expect(await store.getPublishedEntryBySlug({ collection: contentCollection, slug: "draft-only-post" })).toEqual({
			status: "not_found",
		});
	});

	it("발행 뒤 working 본문을 수정하면 미리보기는 최신 working을 본다", async () => {
		const draft = await seedDraft("edited-after-publish", "발행 전 본문");

		await store.publishEntry({ id: draft.id, expectedVersion: draft.version });

		const edited = await store.getEntry(draft.id);
		await seedSave(store, draft.id, {
			expectedVersion: edited.version,
			slug: "edited-after-publish",
			metadata: { title: "편집된 제목" },
			mdx: "발행 후 편집 본문",
			schemaVersion: 1,
			contentHash: "hash-edited-after-publish",
		});

		const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "edited-after-publish" });

		expect(found?.status).toBe("published");
		expect(found?.working.mdx).toBe("발행 후 편집 본문");
		expect(found?.published?.mdx).toBe("발행 전 본문");
	});

	it("없는 slug는 null이다", async () => {
		expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "does-not-exist" })).toBeNull();
	});

	it("다른 컬렉션의 같은 slug는 찾지 않는다", async () => {
		const other = await seedEntry(store, {
			collection: elsewhere,
			slug: "shared-slug",
			metadata: { title: "메모" },
			mdx: "메모 본문",
			schemaVersion: 1,
			contentHash: "hash-memo-shared",
		});
		expect(other.workingSlug).toBe("shared-slug");

		expect(await store.getWorkingEntryBySlug({ collection: elsewhere, slug: "shared-slug" })).not.toBeNull();
		expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "shared-slug" })).toBeNull();
	});

	it("잘못된 입력은 조용히 null이 아니라 invalid_input으로 거부한다", async () => {
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "" })).rejects.toBeInstanceOf(
			CmsError,
		);
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "  " })).rejects.toMatchObject({
			code: "invalid_input",
		});
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection } as never)).rejects.toMatchObject({
			code: "invalid_input",
		});
	});
});

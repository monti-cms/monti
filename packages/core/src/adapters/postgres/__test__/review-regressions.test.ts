import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField, requiredMetadata } from "../../../../test/any-site";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../core/collections";
import { prepareSnapshot, validateForPublish } from "../../../core/snapshot";
import { storedFields } from "../../../schema/derive";
import { createBulkService } from "../../../services/bulk-service";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** 본문 컬렉션에서 항목 컬렉션을 여러 개 고르는 첫 관계 필드(태그 같은 것). 없으면 일괄 추가 테스트를 건너뛴다. */
const manyRelation = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return undefined;
})();
/** 목록 거르기에 쓰는 관계 필드. 여러 개를 고르는 필드를 먼저 쓴다. */
const filterRelation = manyRelation ?? recordRelationField(contentCollection);
/**
 * 문서 컬렉션을 가리키는 첫 관계 필드(어느 컬렉션에 있든). 참조된 문서의 영구 삭제를 시험한다.
 * 참조된 항목은 휴지통에도 못 넣으므로(§6.1) 문서여야 한다. 없는 설정이면 건너뛴다.
 */
const documentRelation = (() => {
	for (const collection of COLLECTIONS) {
		for (const { name, field, when } of storedFields(collection)) {
			if (field.kind === "relation" && !isItemCollection(field.to)) {
				return { collection, name, to: field.to as Collection, many: Boolean(field.many), when };
			}
		}
	}
	return undefined;
})();
const relationValue = (field: { many: boolean }, id: string) => (field.many ? [id] : id);

/**
 * 코드 리뷰(2026-09-26)에서 재현한 결함의 회귀 테스트. 실제 PostgreSQL과 운영 쓰기 경로를 쓴다.
 * 컬렉션·필드 이름은 지금 설정에서 찾는다(`test/any-site.ts`).
 */
describe("review regressions", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	/** 대상 컬렉션의 새 공개 항목(항목 컬렉션은 저장이 곧 공개다). */
	const createTarget = async (to: Collection, title = unique(`target ${to}`)): Promise<Entry> => {
		const metadata = await requiredMetadata(to, title, relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		return draft.status === "published" ? draft : store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	/** 발행 필수 관계가 쓰는 대상(한 번 만들어 다시 쓴다). */
	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const id = (await createTarget(to)).id;
		targets.set(to, id);
		return id;
	};

	const contentMetadata = async (title: string, extra: Record<string, unknown> = {}) => ({
		...(await requiredMetadata(contentCollection, title, relationTarget)),
		...extra,
	});

	const publishedPost = async (extra: Record<string, unknown> = {}, mdx = "본문") => {
		const draft = await service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await contentMetadata("글", extra),
			mdx,
		});
		return store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	/** `documentRelation`으로 `targetId`를 가리키는 글. 조건부 필드면 조건 값도 채운다. */
	const createReferrer = async (title: string, targetId: string) => {
		if (!documentRelation) throw new Error("no relation into a document collection");
		const { collection, name, many, when } = documentRelation;
		const metadata = {
			...(await requiredMetadata(collection, title, relationTarget)),
			...(when ? { [when.field]: when.value } : {}),
			[name]: many ? [targetId] : targetId,
		};
		return service.createDraft({ collection, slug: unique("referrer"), metadata, mdx: "x" });
	};

	it("creates a record from its title alone and derives the slug", async () => {
		const tag = await service.createDraft({
			collection: recordCollection,
			slug: null,
			metadata: await requiredMetadata(recordCollection, "Type Script", relationTarget),
			mdx: "",
		});
		expect(tag.status).toBe("published");
		expect(tag.publishedSlug).toBe("type-script");
	});

	it("refuses unarchive/restore from a published state instead of silently unpublishing", async () => {
		const post = await publishedPost();
		await expect(store.unarchiveEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});
		await expect(store.restoreEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});
		expect(
			(await store.getPublishedEntryBySlug({ collection: contentCollection, slug: post.publishedSlug ?? "" })).status,
		).toBe("current");
	});

	it("restores a trashed record as an active (public) record", async () => {
		const tag = await service.createDraft({
			collection: recordCollection,
			slug: null,
			metadata: await requiredMetadata(recordCollection, unique("tag"), relationTarget),
			mdx: "",
		});
		const trashed = await store.trashEntry({ id: tag.id, expectedVersion: tag.version });
		const restored = await store.restoreEntry({ id: tag.id, expectedVersion: trashed.version });
		expect(restored.status).toBe("published");
	});

	it("permanently deletes only trashed entries and releases never-published slugs", async () => {
		const post = await publishedPost();
		await expect(store.permanentDeleteEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});

		const slug = unique("never-published");
		const draft = await service.createDraft({
			collection: contentCollection,
			slug,
			metadata: { title: "x" },
			mdx: "x",
		});
		const trashedDraft = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
		await store.permanentDeleteEntry({ id: draft.id, expectedVersion: trashedDraft.version });
		const reused = await service.createDraft({
			collection: contentCollection,
			slug,
			metadata: { title: "y" },
			mdx: "y",
		});
		expect(reused.workingSlug).toBe(slug);
	});

	it.skipIf(!documentRelation)(
		"blocks permanently deleting a trashed entry that another entry references",
		async () => {
			if (!documentRelation) return;
			const target = await createTarget(documentRelation.to);
			const referrer = await createReferrer("참조하는 글", target.id);
			if (referrer.status !== "published")
				await store.publishEntry({ id: referrer.id, expectedVersion: referrer.version });
			const trashed = await store.trashEntry({ id: target.id, expectedVersion: target.version });
			await expect(
				store.permanentDeleteEntry({ id: target.id, expectedVersion: trashed.version }),
			).rejects.toMatchObject({
				code: "in_use",
				details: {
					usages: expect.arrayContaining([expect.objectContaining({ collection: documentRelation.collection })]),
				},
			});
		},
	);

	it.skipIf(!manyRelation)("adds tags in bulk to an entry that has no tags yet", async () => {
		if (!manyRelation) return;
		const tag = await createTarget(manyRelation.to, unique("bulk"));
		const metadata = await contentMetadata("n");
		delete metadata[manyRelation.name];
		const post = await service.createDraft({
			collection: contentCollection,
			slug: unique("untagged"),
			metadata,
			mdx: "x",
		});
		const { results } = await createBulkService(store).run({
			op: "relation.add",
			field: manyRelation.name,
			items: [{ id: post.id, expectedVersion: post.version }],
			ids: [tag.id],
		});
		expect(results).toEqual([{ id: post.id, ok: true, version: post.version + 1 }]);
		expect((await store.getEntry(post.id)).working.metadata[manyRelation.name]).toEqual([tag.id]);
	});

	it.skipIf(!documentRelation)(
		"permanently deletes trashed items in bulk and names the entries that still reference a blocked one (v2 A3)",
		async () => {
			if (!documentRelation) return;
			const target = await service.createDraft({
				collection: documentRelation.to,
				slug: unique("replaced"),
				metadata: await requiredMetadata(documentRelation.to, "대체될 글", relationTarget),
				mdx: "x",
			});
			const referrer = await createReferrer("참조하는 글", target.id);
			const loose = await service.createDraft({
				collection: contentCollection,
				slug: unique("loose"),
				metadata: { title: "l" },
				mdx: "l",
			});
			const trashedTarget = await store.trashEntry({ id: target.id, expectedVersion: target.version });
			const trashedLoose = await store.trashEntry({ id: loose.id, expectedVersion: loose.version });

			const { results } = await createBulkService(store).run({
				op: "permanentDelete",
				items: [
					{ id: target.id, expectedVersion: trashedTarget.version },
					{ id: loose.id, expectedVersion: trashedLoose.version },
					{ id: referrer.id, expectedVersion: referrer.version },
				],
			});

			expect(results[0]).toMatchObject({ id: target.id, ok: false, error: "in_use" });
			expect(results[0]?.ok === false && results[0].usages?.map((usage) => usage.title)).toEqual(["참조하는 글"]);
			expect(results[1]).toEqual({ id: loose.id, ok: true, version: trashedLoose.version });
			expect(results[2]).toMatchObject({ id: referrer.id, ok: false, error: "invalid_status" });
			await expect(store.getEntry(loose.id)).rejects.toMatchObject({ code: "not_found" });
			expect((await store.getEntry(target.id)).status).toBe("trashed");
		},
	);

	it("blocks publishing an image without alt (§5.6)", async () => {
		// 블로그 블록(탭·툴팁·정렬)의 필수 속성 검사는 `review-regressions.blog.test.ts`에 있다.
		const mdx = '::image{mediaId="11111111-1111-4111-8111-111111111111"}';
		const snapshot = await prepareSnapshot({ collection: contentCollection, slug: "m", metadata: { title: "m" }, mdx });
		const result = validateForPublish(snapshot, {
			targets: [],
			media: [{ id: "11111111-1111-4111-8111-111111111111" }],
		});
		expect(result.ready).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain("missing_image_alt");
	});

	it("duplicates without the publish date and with a hash that matches its metadata", async () => {
		const draft = await service.createDraft({
			collection: contentCollection,
			slug: unique("dup"),
			metadata: await contentMetadata("원본"),
			mdx: "본문",
		});
		const source = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		expect(source.publishedAt).toBeInstanceOf(Date);
		const copy = await store.duplicateEntry({ id: source.id, title: "원본 (복사)" });
		expect(copy.publishedAt).toBeUndefined();
		expect(copy.working.metadata.title).toBe("원본 (복사)");
		const recomputed = await prepareSnapshot({
			collection: contentCollection,
			slug: null,
			metadata: copy.working.metadata as never,
			mdx: copy.working.mdx,
		});
		expect(copy.working.contentHash).toBe(recomputed.contentHash);
	});

	it("can return to a previous public slug of the same entry", async () => {
		const post = await publishedPost();
		const original = post.publishedSlug as string;
		const renamed = await service.saveDraft(post.id, {
			collection: contentCollection,
			slug: unique("renamed"),
			metadata: post.working.metadata as never,
			mdx: post.working.mdx,
			expectedVersion: post.version,
		});
		const republished = await store.publishEntry({ id: post.id, expectedVersion: renamed.version });
		const back = await service.saveDraft(post.id, {
			collection: contentCollection,
			slug: original,
			metadata: post.working.metadata as never,
			mdx: post.working.mdx,
			expectedVersion: republished.version,
		});
		const final = await store.publishEntry({ id: post.id, expectedVersion: back.version });
		expect(final.publishedSlug).toBe(original);
	});

	it.skipIf(!filterRelation)("filters the admin list by trash, tag and unpublished changes", async () => {
		if (!filterRelation) return;
		const tag = await createTarget(filterRelation.to, unique("filter"));
		const tagged = await publishedPost({ [filterRelation.name]: relationValue(filterRelation, tag.id) });
		const changed = await service.saveDraft(tagged.id, {
			collection: contentCollection,
			slug: tagged.workingSlug,
			metadata: { ...(tagged.working.metadata as object), title: "수정 중" } as never,
			mdx: tagged.working.mdx,
			expectedVersion: tagged.version,
		});

		const relations = { [filterRelation.name]: [tag.id] };
		const byTag = await store.listEntries({ collection: contentCollection, relations });
		expect(byTag.items.map((item) => item.id)).toEqual([tagged.id]);
		expect(byTag.items[0]?.hasUnpublishedChanges).toBe(true);
		expect(byTag.items[0]?.relations[filterRelation.name]).toEqual([{ id: tag.id, title: expect.any(String) }]);

		const withChanges = await store.listEntries({ collection: contentCollection, hasUnpublishedChanges: true });
		expect(withChanges.items.map((item) => item.id)).toContain(tagged.id);

		const trashed = await store.trashEntry({ id: tagged.id, expectedVersion: changed.version });
		expect((await store.listEntries({ collection: contentCollection, relations })).items).toHaveLength(0);
		const trash = await store.listEntries({ collection: contentCollection, statuses: ["trashed"] });
		expect(trash.items.find((item) => item.id === tagged.id)?.trashedAt).toBeInstanceOf(Date);
		expect(trashed.status).toBe("trashed");
	});

	it("refuses to delete media that an unparsed draft or a template still mentions", async () => {
		const media = await store.createMediaAsset({
			filename: "a.png",
			mimeType: "image/png",
			byteSize: 10,
			stagingKey: "staging/a.png",
		});
		await store.completeMediaAsset({
			id: media.id,
			storageKey: "media/a.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
		});
		await store.createTemplate({
			name: unique("tpl"),
			mdx: `::image{mediaId="${media.id}" alt="a"}`,
		});
		await expect(store.beginMediaDelete(media.id)).rejects.toMatchObject({
			code: "in_use",
			details: { templates: 1 },
		});
		expect((await store.getMediaAsset(media.id))?.status).toBe("ready");
	});
});

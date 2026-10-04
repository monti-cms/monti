import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	otherContentCollection,
	recordCollection,
	recordRelationField,
	requiredMetadata,
} from "../../../../test/any-site";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../core/collections";
import { storedFields } from "../../../schema/derive";
import { SUMMARY_ROLE } from "../../../schema/fields";
import { type ContentStore, createContentStore, migrateContentStore } from "../content-store";
import { seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * M7-BE-1 공개 published 읽기 계약 (실DB).
 *
 * 확인 대상(O1 A3/A4/A8): 초안·보관·휴지통·예약 주소는 어떤 경로로도 공개되지 않고,
 * 발행본만 정규 current slug로 조회되며, 과거 주소는 alias로 판정된다.
 * 컬렉션·필드 이름은 지금 설정에서 찾는다(`test/any-site.ts`). 블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다.
 */

const content = contentCollection;
/** 휴지통 시험용 문서 컬렉션(두 번째가 없으면 같은 컬렉션). */
const trashContent = otherContentCollection ?? contentCollection;
/** 분류 레코드 두 종류(항목 컬렉션이 하나뿐이면 같은 컬렉션의 두 항목). */
const itemCollections = COLLECTIONS.filter((name) => isItemCollection(name));
const otherRecordCollection = itemCollections.find((name) => name !== recordCollection) ?? recordCollection;
/** 요약 역할의 텍스트 필드 이름(있으면). */
const summaryField = storedFields(content).find(
	({ field }) => field.kind === "text" && field.role === SUMMARY_ROLE,
)?.name;
const summaryOf = (value: string): Record<string, string> => (summaryField ? { [summaryField]: value } : {});
/** 항목을 가리키는 관계 필드. 여러 개를 고르는 필드를 먼저 쓴다(블로그의 태그). */
const tagLikeRelation = (() => {
	for (const { name, field, when } of storedFields(content)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return recordRelationField(content);
})();
const relationValue = (id: string) => (tagLikeRelation?.many ? [id] : id);
describe("M7-BE-1 공개 published 읽기 계약", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let relationTarget: (to: Collection) => Promise<string>;
	/** 발행 필수값을 채운 메타데이터(저장소가 채우는 값과 같다). */
	const filled = async (title: string, extra: Record<string, unknown> = {}) => ({
		...(await requiredMetadata(content, title, relationTarget)),
		...extra,
	});

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// 발행 필수값(블로그의 카테고리 등)은 이 파일의 시나리오와 무관하므로 저장소가 채운다.
		relationTarget = fillRequiredMetadata(store).relationTarget;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function createEntry(params: {
		collection: string;
		slug: string;
		metadata?: Record<string, unknown>;
		mdx?: string;
	}) {
		const metadata = params.metadata ?? { title: params.slug };
		return seedEntry(store, {
			collection: params.collection,
			slug: params.slug,
			metadata,
			mdx: params.mdx ?? `# ${params.slug}`,
			schemaVersion: 1,
			contentHash: `hash-${params.slug}`,
		});
	}

	async function createPublishedEntry(params: {
		collection: string;
		slug: string;
		metadata?: Record<string, unknown>;
		mdx?: string;
	}) {
		const entry = await createEntry(params);

		return store.publishEntry({ id: entry.id, expectedVersion: entry.version });
	}

	async function publishedSlugs(collections: readonly string[]): Promise<string[]> {
		const rows = await store.listPublishedEntries({ collections });

		return rows.map((row) => row.slug);
	}

	async function addressType(slug: string): Promise<string | undefined> {
		const res = await pool.query<{ type: string }>(
			`SELECT type FROM "${schemaName}".content_addresses WHERE slug = $1`,
			[slug],
		);

		return res.rows[0]?.type;
	}

	it("초안은 공개 목록과 단건 조회에 나오지 않는다", async () => {
		const draft = await createEntry({ collection: content, slug: "draft-only", metadata: { title: "초안" } });

		expect(draft.status).toBe("draft");
		expect(await addressType("draft-only")).toBe("reservation");
		expect(await publishedSlugs([content])).not.toContain("draft-only");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "draft-only" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("발행하면 정규 slug와 본문·metadata가 공개 조회에 나타난다", async () => {
		await createPublishedEntry({
			collection: content,
			slug: "live-post",
			metadata: { title: "공개 글", ...summaryOf("요약") },
			mdx: "# 공개 본문",
		});

		expect(await publishedSlugs([content])).toContain("live-post");
		expect(await addressType("live-post")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.slug).toBe("live-post");
			expect(lookup.entry.mdx).toBe("# 공개 본문");
			expect(lookup.entry.metadata).toEqual(await filled("공개 글", summaryOf("요약")));
			expect(lookup.entry.publishedAt).toBeInstanceOf(Date);
		}
	});

	it("목록 조회는 기본적으로 본문을 싣지 않고 요청할 때만 싣는다", async () => {
		const withoutBody = await store.listPublishedEntries({ collections: [content] });
		const withBody = await store.listPublishedEntries({ collections: [content], includeBody: true });

		expect(withoutBody.length).toBeGreaterThan(0);
		expect(withoutBody.every((row) => row.mdx === "")).toBe(true);
		expect(withBody.some((row) => row.mdx.length > 0)).toBe(true);
	});

	it("단건 조회는 기본적으로 본문을 싣는다", async () => {
		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.mdx).toBe("# 공개 본문");
		}
	});

	it("보관하면 공개 조회에서 사라진다", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "to-archive" });

		expect(await publishedSlugs([content])).toContain("to-archive");

		await store.archiveEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs([content])).not.toContain("to-archive");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "to-archive" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("휴지통으로 보내면 공개 조회에서 사라진다", async () => {
		const published = await createPublishedEntry({ collection: trashContent, slug: "to-trash" });

		expect(await publishedSlugs([trashContent])).toContain("to-trash");

		await store.trashEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs([trashContent])).not.toContain("to-trash");
		await expect(store.getPublishedEntryBySlug({ collection: trashContent, slug: "to-trash" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("slug를 바꾸면 이전 주소는 alias로 판정되고 정규 slug를 반환한다", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "before-rename" });
		const saved = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "after-rename",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-renamed",
		});

		await store.publishEntry({ id: saved.id, expectedVersion: saved.version });

		expect(await addressType("before-rename")).toBe("alias");
		expect(await addressType("after-rename")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: content, slug: "before-rename" });

		expect(lookup.status).toBe("alias");
		if (lookup.status === "alias") {
			expect(lookup.entry.slug).toBe("after-rename");
			expect(lookup.entry.mdx).toBe("# 이름 변경");
		}
	});

	it.skipIf(!tagLikeRelation)("공개 글의 working 수정은 재발행 전까지 기존 published snapshot을 보존한다", async () => {
		const tagCollection = tagLikeRelation?.to ?? recordCollection;
		const tagField = tagLikeRelation?.name ?? "";
		const publishedTag = await createPublishedEntry({
			collection: tagCollection,
			slug: "f10-published-tag",
			metadata: { title: "Published tag" },
		});
		const workingTag = await createPublishedEntry({
			collection: tagCollection,
			slug: "f10-working-tag",
			metadata: { title: "Working tag" },
		});
		const published = await createPublishedEntry({
			collection: content,
			slug: "f10-published-snapshot",
			metadata: {
				title: "Published title",
				...summaryOf("Published summary"),
				[tagField]: relationValue(publishedTag.id),
			},
			mdx: "# Published body",
		});
		const working = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "f10-working-snapshot",
			metadata: {
				title: "Working title",
				...summaryOf("Working summary"),
				[tagField]: relationValue(workingTag.id),
			},
			mdx: "# Working body",
			schemaVersion: 1,
			contentHash: "f10-working-content",
		});

		expect(working.status).toBe("published");
		expect(await publishedSlugs([content])).toContain("f10-published-snapshot");
		expect(await publishedSlugs([content])).not.toContain("f10-working-snapshot");
		const beforeRepublish = await store.getPublishedEntryBySlug({
			collection: content,
			slug: "f10-published-snapshot",
		});
		expect(beforeRepublish.status).toBe("current");
		if (beforeRepublish.status === "current") {
			expect(beforeRepublish.entry.slug).toBe("f10-published-snapshot");
			expect(beforeRepublish.entry.mdx).toBe("# Published body");
			expect(beforeRepublish.entry.metadata).toEqual(
				await filled("Published title", {
					...summaryOf("Published summary"),
					[tagField]: relationValue(publishedTag.id),
				}),
			);
		}
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "f10-working-snapshot" })).resolves.toEqual(
			{
				status: "not_found",
			},
		);

		const republished = await store.publishEntry({ id: working.id, expectedVersion: working.version });
		expect(await store.getPublishedEntryBySlug({ collection: content, slug: "f10-published-snapshot" })).toMatchObject({
			status: "alias",
			entry: { slug: "f10-working-snapshot", mdx: "# Working body" },
		});
		expect(await store.getPublishedEntryBySlug({ collection: content, slug: "f10-working-snapshot" })).toMatchObject({
			status: "current",
			entry: { slug: "f10-working-snapshot", mdx: "# Working body", metadata: { title: "Working title" } },
		});
		expect(republished.status).toBe("published");
	});
	it("비공개로 돌아간 주소는 alias로도 남지 않는다", async () => {
		const published = await createPublishedEntry({ collection: content, slug: "alias-then-archive" });
		const saved = await seedSave(store, published.id, {
			expectedVersion: published.version,
			slug: "alias-then-archive-2",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-alias-archive",
		});
		const republished = await store.publishEntry({ id: saved.id, expectedVersion: saved.version });

		await store.archiveEntry({ id: republished.id, expectedVersion: republished.version });

		expect(await addressType("alias-then-archive")).toBe("alias");
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "alias-then-archive" })).resolves.toEqual({
			status: "not_found",
		});
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "alias-then-archive-2" })).resolves.toEqual(
			{
				status: "not_found",
			},
		);
	});

	it("분류 레코드(항목 컬렉션)도 공개 조회되고 휴지통으로 옮기면 제외된다", async () => {
		const tag = await createPublishedEntry({
			collection: recordCollection,
			slug: "public-tag",
			metadata: { title: "공개 태그" },
		});
		await createPublishedEntry({
			collection: otherRecordCollection,
			slug: "public-category",
			metadata: { title: "공개 분류" },
		});

		expect(await publishedSlugs([...new Set([recordCollection, otherRecordCollection])])).toEqual(
			expect.arrayContaining(["public-tag", "public-category"]),
		);

		// record 컬렉션은 보관이 없고 활성/휴지통만 쓴다(§5.3).
		await store.trashEntry({ id: tag.id, expectedVersion: tag.version });

		expect(await publishedSlugs([recordCollection])).not.toContain("public-tag");
		expect(await publishedSlugs([otherRecordCollection])).toContain("public-category");
	});

	it("여러 컬렉션을 한 번에 읽을 수 있고 발행되지 않은 항목은 섞이지 않는다", async () => {
		await createEntry({ collection: recordCollection, slug: "draft-tag", metadata: { title: "초안 태그" } });

		const rows = await store.listPublishedEntries({ collections: COLLECTIONS });

		expect(rows.every((row) => row.collection !== "secret")).toBe(true);
		expect(rows.map((row) => row.slug)).not.toContain("draft-tag");
	});

	it("허용되지 않은 컬렉션은 거부한다", async () => {
		await expect(store.listPublishedEntries({ collections: ["secret"] })).rejects.toThrow(/컬렉션|collection/);
		await expect(store.listPublishedEntries({ collections: [] })).rejects.toThrow();
		await expect(store.getPublishedEntryBySlug({ collection: "secret", slug: "x" })).rejects.toThrow();
	});

	it("빈 slug는 거부한다", async () => {
		await expect(store.getPublishedEntryBySlug({ collection: content, slug: "" })).rejects.toThrow();
	});
});

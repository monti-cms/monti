import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	contentCollection,
	otherContentCollection,
	recordCollection,
	requiredMetadata,
	titleFieldOf,
} from "../../../test/any-site";
import { COLLECTIONS, type Collection, DOCUMENT_COLLECTIONS } from "../../core/collections";
import { type StoredField, storedField, storedFields } from "../../schema/derive";
import { isRequiredField } from "../../schema/fields";
import type { PreparedSnapshot, Reference, ResolvedTargets, SaveDraftInput, ServiceInput, StorePort } from "../index";
import {
	createContentService,
	imageWarningsForPublish,
	prepareSnapshot,
	ServiceError,
	validateForPublish,
} from "../index";

/*
 * 컬렉션·필드 이름은 지금 설정에서 찾는다(M10-1). 블로그 예시 설정에서는 본문 컬렉션이 게시글(`post`),
 * 하나짜리 관계가 `categoryId`(→ category), 여러 개짜리 관계가 `tagIds`(→ tag), 두 번째 컬렉션이 메모(`memo`)다.
 */
const content = contentCollection;
/** 조건부 필드에 딸리지 않은 저장 필드. */
const topLevel = (collection: Collection): StoredField[] => storedFields(collection).filter(({ when }) => !when);
const relationOf = (many: boolean) => {
	for (const { name, field } of topLevel(content)) {
		if (field.kind === "relation" && Boolean(field.many) === many) {
			return { name, to: field.to as Collection, required: isRequiredField(field) };
		}
	}
	throw new Error(`content-service: ${content} has no ${many ? "many" : "single"} relation field`);
};
const single = relationOf(false);
const many = relationOf(true);
/** 두 번째 컬렉션(블로그: 메모). 본문이 있는 문서 컬렉션이 하나뿐이면 첫 항목 컬렉션. */
const second = otherContentCollection ?? recordCollection;
/** 본문 컬렉션의 하나짜리 관계 필드가 없는 다른 컬렉션(블로그: 메모). */
const withoutSingle = [second, ...COLLECTIONS].find(
	(name) => name !== content && !storedField(name, single.name),
) as Collection;
/** 본문 컬렉션의 첫 선택 필드(블로그: 정책 `policy`). */
const selectField = topLevel(content).find(({ field }) => field.kind === "select");
/** 글자 수 한도가 없는 텍스트 필드(블로그: 요약 `summary`). 메타데이터 크기 한도를 시험한다. */
const unboundedText = topLevel(content).find(
	({ name, field }) => name !== "title" && field.kind === "text" && field.max === undefined,
);
/** 아직 공개되지 않은 글도 순서대로 담는 목록 관계(블로그: 모음집 `collection`의 `itemIds`). */
const orderedList = (() => {
	for (const collection of COLLECTIONS) {
		for (const { name, field } of storedFields(collection)) {
			if (field.kind === "relation" && field.many && field.allowUnpublished) {
				return { collection, name, to: field.to as Collection };
			}
		}
	}
	return undefined;
})();
/** 목록 관계가 담지 못하는 컬렉션(블로그: 메모). */
const notListable = [...DOCUMENT_COLLECTIONS, ...COLLECTIONS].find((name) => name !== orderedList?.to) as Collection;

/** 타입이 컬렉션마다 다른 입력을 설정에서 찾은 이름으로 만든다. */
const input = (value: {
	collection: Collection;
	slug: string | null;
	metadata: Record<string, unknown>;
	mdx: string;
}): ServiceInput => value as unknown as ServiceInput;

/** 컬렉션의 저장 필드를 모두 채운 메타데이터. 선택 필드는 첫 선택지이고 그 값에 딸린 조건부 필드도 채운다. */
const canonicalMetadata = (collection: Collection): Record<string, unknown> => {
	const metadata: Record<string, unknown> = {};
	for (const { name, field, when } of storedFields(collection)) {
		if (when && metadata[when.field] !== when.value) continue;
		if (field.kind === "text") metadata[name] = name === "title" ? "T" : "S";
		else if (field.kind === "select") metadata[name] = Object.keys(field.options)[0];
		else if (field.kind === "relation") {
			metadata[name] = field.many ? ["123e4567-e89b-12d3-a456-426614174001"] : "123e4567-e89b-12d3-a456-426614174000";
		} else if (field.kind === "media") metadata[name] = "123e4567-e89b-12d3-a456-426614174002";
	}
	return metadata;
};

describe("ContentService M2-TW-1 Contract", () => {
	describe("1. Metadata Allowlists & Collection Rules", () => {
		it.each([
			["unknown collection", { collection: "unknown", slug: "test", metadata: {}, mdx: "" }, "unknown_collection"],
			[
				"content with wrong title type",
				{ collection: content, slug: "valid", metadata: { title: 123 }, mdx: "" },
				"invalid_metadata_type",
			],
			[
				"content with wrong many-relation type",
				{ collection: content, slug: "valid", metadata: { [many.name]: "tag-1" }, mdx: "" },
				"invalid_metadata_type",
			],
			...(selectField
				? [
						[
							"content with unsupported select value",
							{ collection: content, slug: "valid", metadata: { [selectField.name]: "unsupported" }, mdx: "" },
							"invalid_metadata_value",
						] as [string, unknown, string],
					]
				: []),
			[
				"non-JSON value in title",
				{ collection: content, slug: "valid", metadata: { title: () => {} }, mdx: "" },
				"invalid_metadata_type",
			],
			[
				"cross-collection canonical key (single relation on another collection)",
				{ collection: withoutSingle, slug: "valid", metadata: { [single.name]: "cat-1" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"unknown metadata key on a record",
				{ collection: recordCollection, slug: "valid", metadata: { fakeKey: "fail" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"content with system metadata createdAt",
				{ collection: content, slug: "valid", metadata: { createdAt: "2023-01-01" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"record with invented metadata index",
				{ collection: recordCollection, slug: "valid", metadata: { index: 1 }, mdx: "" },
				"invalid_metadata_key",
			],
		] satisfies Array<[string, unknown, string]>)("rejects %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it.each(
			COLLECTIONS.map((collection) => [
				collection,
				input({ collection, slug: "s", metadata: canonicalMetadata(collection), mdx: "" }),
			]),
		)("permits canonical keys for %s", async (_, input) => {
			const result = await prepareSnapshot(input);
			expect(result.metadata).toEqual(input.metadata);
		});

		it("permits missing title/summary/category for draft preparation", async () => {
			const result = await prepareSnapshot({
				collection: content,
				slug: "draft-post",
				metadata: {},
				mdx: "",
			});
			expect(result.metadata).toEqual({});
			expect(result.issues.some((i: { code: string }) => i.code === "missing_field")).toBe(false);
		});
	});

	describe("2. Slug Normalization", () => {
		it.each([
			["   ", null],
			["cafe\u0301", "café"],
		])("normalizes slug %j to %j", async (inputSlug, expectedSlug) => {
			const result = await prepareSnapshot({
				collection: content,
				slug: inputSlug,
				metadata: {},
				mdx: "",
			});
			expect(result.slug).toBe(expectedSlug);
		});

		it.each([
			"test/path",
			"test?query",
			"test#hash",
			"test\u0000",
		])("rejects forbidden characters in slug: %j", async (inputSlug) => {
			await expect(
				prepareSnapshot({ collection: content, slug: inputSlug, metadata: {}, mdx: "" }),
			).rejects.toMatchObject({ code: "invalid_slug_format" });
		});

		it("accepts exactly 200 Unicode code points and rejects 201", async () => {
			const slug200 = "😀".repeat(200);
			const slug201 = "😀".repeat(201);
			const result = await prepareSnapshot({ collection: content, slug: slug200, metadata: {}, mdx: "" });
			expect(result.slug).toBe(slug200);
			await expect(
				prepareSnapshot({ collection: content, slug: slug201, metadata: {}, mdx: "" }),
			).rejects.toMatchObject({ code: "slug_too_long" });
		});

		it.skipIf(titleFieldOf(content).max === undefined)(
			"accepts exactly the title field's max Unicode code points and rejects one more",
			async () => {
				const { max = 0, label } = titleFieldOf(content);
				const titleMax = "😀".repeat(max);
				const titleOver = "😀".repeat(max + 1);
				const result = await prepareSnapshot(
					input({ collection: content, slug: "valid", metadata: { title: titleMax }, mdx: "" }),
				);
				expect(result.metadata.title).toBe(titleMax);
				await expect(
					prepareSnapshot(input({ collection: content, slug: "valid", metadata: { title: titleOver }, mdx: "" })),
				).rejects.toMatchObject({
					code: "field_too_long",
					issues: [{ code: "field_too_long", path: "title", message: label }],
				});
			},
		);

		it("allows equal slug in two different collection inputs", async () => {
			const result1 = await prepareSnapshot({ collection: content, slug: "shared-slug", metadata: {}, mdx: "" });
			const result2 = await prepareSnapshot(input({ collection: second, slug: "shared-slug", metadata: {}, mdx: "" }));
			expect(result1.slug).toBe("shared-slug");
			expect(result2.slug).toBe("shared-slug");
		});
	});

	describe("3. Deterministic Hashing", () => {
		it("computes the SHA-256 vector with key-order equivalence and metadata/MDX/schema changes", async () => {
			const ids = ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"];
			const snapshotOf = (metadata: Record<string, unknown>, mdx = "Hello", schemaVersion = 1) =>
				prepareSnapshot(input({ collection: content, slug: "a", metadata, mdx }), { schemaVersion });
			const snap1 = await snapshotOf({ title: "A", [many.name]: ids });
			const snap2 = await snapshotOf({ [many.name]: ids, title: "A" });

			// 메타데이터 키는 이름순으로 해시한다.
			const sortedMetadata = Object.fromEntries(
				Object.entries({ title: "A", [many.name]: ids }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
			);
			const expectedTuple = ["cms-snapshot-v1", 1, sortedMetadata, "Hello"];
			const expectedHash = createHash("sha256").update(JSON.stringify(expectedTuple)).digest("hex");
			expect(snap1.contentHash).toBe(expectedHash);
			expect(snap1.contentHash).toEqual(snap2.contentHash);

			const snapDiffMdx = await snapshotOf({ title: "A", [many.name]: ids }, "Hello World");
			expect(snap1.contentHash).not.toEqual(snapDiffMdx.contentHash);

			const snapDiffMetadata = await snapshotOf({ title: "B", [many.name]: ids });
			expect(snap1.contentHash).not.toEqual(snapDiffMetadata.contentHash);

			const snapDiffSchema = await snapshotOf({ title: "A", [many.name]: ids }, "Hello", 2);
			expect(snap1.contentHash).not.toEqual(snapDiffSchema.contentHash);
		});

		it("rejects caller provided contentHash", async () => {
			const input = {
				collection: content,
				slug: "a",
				metadata: {},
				mdx: "Hello",
				contentHash: "fakehash",
			};
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: "invalid_input" });
		});
	});

	describe("4. Reference Extraction", () => {
		it("extracts ordered/deduplicated refs with occurrences from metadata relations", async () => {
			const snap = await prepareSnapshot({
				collection: content,
				slug: "a",
				metadata: {
					[single.name]: "123e4567-e89b-12d3-a456-426614174001",
					[many.name]: [
						"123e4567-e89b-12d3-a456-426614174002",
						"123e4567-e89b-12d3-a456-426614174003",
						"123e4567-e89b-12d3-a456-426614174002",
					],
				},
				mdx: "",
			});

			expect(snap.references).toHaveLength(3);

			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174001",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(1);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "metadata", path: single.name });

			expect(snap.references[1]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174002",
				isStale: false,
			});
			expect(snap.references[1].occurrences).toHaveLength(2);
			expect(snap.references[1].occurrences[0]).toMatchObject({ type: "metadata", path: many.name, ordinal: 0 });
			expect(snap.references[1].occurrences[1]).toMatchObject({ type: "metadata", path: many.name, ordinal: 2 });

			expect(snap.references[2]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174003",
				isStale: false,
			});
			expect(snap.references[2].occurrences).toHaveLength(1);
			expect(snap.references[2].occurrences[0]).toMatchObject({ type: "metadata", path: many.name, ordinal: 1 });
		});

		it.skipIf(!orderedList)("extracts ordered/deduplicated refs with occurrences from an ordered list", async () => {
			if (!orderedList) return;
			const snap = await prepareSnapshot(
				input({
					collection: orderedList.collection,
					slug: "a",
					metadata: {
						[orderedList.name]: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174001"],
					},
					mdx: "",
				}),
			);
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174001",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(2);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "metadata", path: orderedList.name, ordinal: 0 });
			expect(snap.references[0].occurrences[1]).toMatchObject({ type: "metadata", path: orderedList.name, ordinal: 1 });
		});

		it("extracts ordered/deduplicated refs with occurrences from Image", async () => {
			const mdx =
				'<Image mediaId="123e4567-e89b-12d3-a456-426614174000" />\n<Image mediaId="987e4567-e89b-12d3-a456-426614174000" />\n<Image mediaId="123e4567-e89b-12d3-a456-426614174000" />';
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, mdx });
			expect(snap.references).toHaveLength(2);

			expect(snap.references[0]).toMatchObject({
				kind: "media",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(2);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "mdx", line: 1, column: 1 });

			expect(snap.references[1]).toMatchObject({
				kind: "media",
				targetId: "987e4567-e89b-12d3-a456-426614174000",
				isStale: false,
			});
			expect(snap.references[1].occurrences).toHaveLength(1);
			expect(snap.references[1].occurrences[0]).toMatchObject({ line: 2, column: 1 });
		});

		it("rejects retired ContentLink with a migration message", async () => {
			const snap = await prepareSnapshot({
				collection: content,
				slug: "a",
				metadata: {},
				mdx: '<ContentLink targetId="123e4567-e89b-12d3-a456-426614174000" />',
			});
			expect(snap.issues).toContainEqual(
				expect.objectContaining({
					code: "mdx_error",
					params: expect.objectContaining({ reason: "retired_jsx_element", name: "ContentLink" }),
				}),
			);
		});

		it.each([
			["<Image mediaId={dynamicId} />", "dynamic_reference_id"],
			['<Image mediaId="not-a-uuid" alt="a" />', "invalid_reference_id"],
			['<Image mediaId="" alt="a" />', "missing_media_id"],
			["<File />", "missing_media_id"],
			["<File mediaId={dynamicId} />", "dynamic_reference_id"],
			['<File mediaId="not-a-uuid" />', "invalid_reference_id"],
		])("creates structured issues for dynamic IDs: %s", async (mdx, expectedIssue) => {
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, mdx });
			expect(snap.issues).toContainEqual(expect.objectContaining({ code: expectedIssue }));
			expect(snap.references).toEqual([]);
		});

		it.each([
			['<Image mediaId="987e4567-e89b-12d3-a456-426614174000" alt="a" />'],
			['<File mediaId="987e4567-e89b-12d3-a456-426614174000" />'],
		])("records a media reference for a registered media ID: %s", async (mdx) => {
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, mdx });
			expect(snap.issues).toEqual([]);
			expect(snap.references).toEqual([
				{
					kind: "media",
					targetId: "987e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			]);
		});

		it("does not reference an external image src", async () => {
			const snap = await prepareSnapshot({
				collection: content,
				slug: "a",
				metadata: {},
				mdx: '<Image src="https://example.com/a.png" alt="a" />',
			});
			expect(snap.issues).toEqual([]);
			expect(snap.references).toEqual([]);
			expect(snap.imageSources).toEqual([{ src: "https://example.com/a.png", position: { line: 1, column: 1 } }]);
		});

		it("retains trusted previous refs marked stale on MDX syntax error and keeps exact MDX unchanged", async () => {
			const mdx = "</Invalid>";
			const previousReferences: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, mdx }, { previousReferences });

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "mdx_error" }));
			expect(snap.mdx).toBe(mdx);
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});

		it("retains trusted previous refs marked stale on semantic-analyze-error", async () => {
			const mdx = "<Image />";
			const previousReferences: Reference[] = [
				{
					kind: "media",
					targetId: "987e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, mdx }, { previousReferences });

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "missing_media_id" }));
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "media",
				targetId: "987e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});
	});

	describe("5. Frontmatter handling", () => {
		it("preserves frontmatter bytes, draft is allowed, but produces frontmatter_present issue making it not ready", async () => {
			const mdx = "---\ntitle: test\n---\nHello";
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.createDraft({
				collection: content,
				slug: "a",
				metadata: {},
				mdx,
			});

			expect(storePort.createEntryWithReferences).toHaveBeenCalledTimes(1);
			const callArg = vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0];
			expect(callArg.snapshot.mdx).toBe(mdx);
			expect(callArg.snapshot.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));

			const validation = validateForPublish(callArg.snapshot, { targets: [], media: [] });
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));
		});
	});

	describe("6. Publish validation tables", () => {
		const validSnap = {
			collection: content,
			slug: "valid-post",
			metadata: {
				title: "Title",
				[single.name]: "123e4567-e89b-12d3-a456-426614174001",
				[many.name]: ["123e4567-e89b-12d3-a456-426614174002"],
			},
			mdx: "Content",
			schemaVersion: 1,
			contentHash: "hash",
			references: [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174001",
					isStale: false,
					occurrences: [{ type: "metadata", path: single.name }],
				},
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174002",
					isStale: false,
					occurrences: [{ type: "metadata", path: many.name, ordinal: 0 }],
				},
			],
			issues: [],
			imageSources: [],
		} as unknown as PreparedSnapshot;

		const validResolvedTargets: ResolvedTargets = {
			targets: [
				{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: single.to },
				{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: many.to },
			],
			media: [],
		};

		it.each([
			[
				"missing title",
				{ ...validSnap, metadata: { [single.name]: "123e4567-e89b-12d3-a456-426614174001" } },
				validResolvedTargets,
				"missing_field",
			],
			["null slug", { ...validSnap, slug: null }, validResolvedTargets, "null_slug"],
			["empty body", { ...validSnap, mdx: "" }, validResolvedTargets, "empty_body"],
			// 하나짜리 관계가 발행 필수일 때만(블로그: 카테고리).
			...(single.required
				? [
						[
							"missing the required single relation",
							{ ...validSnap, metadata: { title: "Title" }, references: [] },
							validResolvedTargets,
							"missing_field",
						] as [string, PreparedSnapshot, ResolvedTargets, string],
					]
				: []),
			[
				"mdx issues",
				{ ...validSnap, issues: [{ code: "mdx_error", message: "Error" }] },
				validResolvedTargets,
				"mdx_error",
			],
			[
				"unresolved content target",
				{
					...validSnap,
					references: [
						{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
					],
				},
				validResolvedTargets,
				"unresolved_reference",
			],
			[
				"unpublished content target",
				{
					...validSnap,
					references: [
						{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
					],
				},
				{
					targets: [
						...validResolvedTargets.targets,
						{ id: "123e4567-e89b-12d3-a456-426614174000", isPublished: false, collection: content },
					],
					media: [],
				},
				"unpublished_reference",
			],
			[
				"unresolved media",
				{
					...validSnap,
					references: [
						...validSnap.references,
						{
							kind: "media",
							targetId: "987e4567-e89b-12d3-a456-426614174000",
							isStale: false,
							occurrences: [],
						},
					],
				},
				validResolvedTargets,
				"unresolved_media",
			],
			["unresolved single relation", validSnap, { targets: [], media: [] }, "unresolved_reference"],
			[
				"wrong-collection single relation",
				validSnap,
				{
					targets: [{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: many.to }],
					media: [],
				},
				"invalid_reference_collection",
			],
			[
				"unresolved many relation",
				validSnap,
				{
					targets: [{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: single.to }],
					media: [],
				},
				"unresolved_reference",
			],
			[
				"wrong-collection many relation",
				validSnap,
				{
					targets: [
						{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: single.to },
						{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: content },
					],
					media: [],
				},
				"invalid_reference_collection",
			],
		] satisfies Array<
			[string, PreparedSnapshot, ResolvedTargets, string]
		>)("not ready when %s", (_, snap, resolved, expectedIssueCode) => {
			const validation = validateForPublish(snap, resolved);
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: expectedIssueCode }));
		});

		it("is ready when valid and targets resolved", () => {
			const validation = validateForPublish(validSnap, validResolvedTargets);
			expect(validation.ready).toBe(true);
		});
	});

	// 아직 공개되지 않은 글도 순서대로 담는 목록 관계가 있는 설정만(블로그: 모음집 `itemIds`).
	describe.skipIf(!orderedList)("7. Ordered list relation (collection itemIds)", () => {
		const list = orderedList ?? { collection: content, name: "", to: content };
		it("preserves declared order and duplicates conservatively, validates target collection", async () => {
			const snap = await prepareSnapshot(
				input({
					collection: list.collection,
					slug: "my-col",
					metadata: {
						[list.name]: [
							"123e4567-e89b-12d3-a456-426614174002",
							"123e4567-e89b-12d3-a456-426614174001",
							"123e4567-e89b-12d3-a456-426614174002",
						],
					},
					mdx: "",
				}),
			);
			const items = snap.metadata[list.name as keyof typeof snap.metadata];
			expect(Array.isArray(items)).toBe(true);
			if (Array.isArray(items)) {
				expect(items).toEqual([
					"123e4567-e89b-12d3-a456-426614174002",
					"123e4567-e89b-12d3-a456-426614174001",
					"123e4567-e89b-12d3-a456-426614174002",
				]);
			}

			const snapWithItems = {
				collection: list.collection,
				slug: "valid-col",
				metadata: {
					title: "T",
					[list.name]: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174002"],
				},
				mdx: "",
				schemaVersion: 1,
				contentHash: "hash",
				references: [],
				issues: [],
				imageSources: [],
			} as unknown as PreparedSnapshot;

			const validation = validateForPublish(snapWithItems, {
				targets: [
					{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: list.to },
					{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: notListable },
				],
				media: [],
			});
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: "invalid_reference_collection" }));
		});

		it("is ready when all resolved IDs are published list targets, preserving order and duplicates", () => {
			const snapWithItems = {
				collection: list.collection,
				slug: "valid-col",
				metadata: {
					title: "Title",
					[list.name]: [
						"123e4567-e89b-12d3-a456-426614174001",
						"123e4567-e89b-12d3-a456-426614174002",
						"123e4567-e89b-12d3-a456-426614174001",
					],
				},
				mdx: "",
				schemaVersion: 1,
				contentHash: "hash",
				references: [
					{
						kind: "entry",
						targetId: "123e4567-e89b-12d3-a456-426614174001",
						isStale: false,
						occurrences: [
							{ type: "metadata", path: list.name, ordinal: 0 },
							{ type: "metadata", path: list.name, ordinal: 2 },
						],
					},
					{
						kind: "entry",
						targetId: "123e4567-e89b-12d3-a456-426614174002",
						isStale: false,
						occurrences: [{ type: "metadata", path: list.name, ordinal: 1 }],
					},
				],
				issues: [],
				imageSources: [],
			} as unknown as PreparedSnapshot;

			const validation = validateForPublish(snapWithItems, {
				targets: [
					{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: list.to },
					{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: list.to },
				],
				media: [],
			});
			expect(validation.ready).toBe(true);
			expect(validation.issues).toHaveLength(0);
		});
	});

	describe("8. Publish preflight completeness", () => {
		it.skipIf(!orderedList)("allows unpublished targets only through an ordered list relation", async () => {
			if (!orderedList) return;
			const id = "123e4567-e89b-12d3-a456-426614174099";
			const snapshot = await prepareSnapshot(
				input({
					collection: orderedList.collection,
					slug: "series",
					metadata: { title: "Series", [orderedList.name]: [id] },
					mdx: "",
				}),
			);
			const validation = validateForPublish(snapshot, {
				targets: [{ id, isPublished: false, collection: orderedList.to }],
				media: [],
			});
			expect(validation.ready).toBe(true);
		});

		it("reports every unresolved reference with metadata occurrence", async () => {
			const ids = ["123e4567-e89b-12d3-a456-426614174091", "123e4567-e89b-12d3-a456-426614174092"];
			const snapshot = await prepareSnapshot(
				input({ collection: content, slug: "memo", metadata: { title: "Memo", [many.name]: ids }, mdx: "Body" }),
			);
			const validation = validateForPublish(snapshot, { targets: [], media: [] });
			expect(validation.issues.filter((issue) => issue.code === "unresolved_reference")).toEqual([
				expect.objectContaining({ path: many.name, ordinal: 0 }),
				expect.objectContaining({ path: many.name, ordinal: 1 }),
			]);
		});

		it("preserves MDX analyser positions in blocking issues", async () => {
			const snapshot = await prepareSnapshot(
				input({
					collection: content,
					slug: "memo",
					metadata: { title: "Memo" },
					mdx: 'First line\n<ContentLink targetId="bad" />',
				}),
			);
			expect(snapshot.issues).toContainEqual(
				expect.objectContaining({ code: "mdx_error", position: { line: 2, column: 1 } }),
			);
		});
	});

	describe("9. Service Orchestration & Fake Port", () => {
		it("saveDraft propagates save port rejection exact error after one mutation attempt", async () => {
			const exactError = { code: "concurrent_modification", message: "Conflict" };
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue([]),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockRejectedValue(exactError),
			};
			const service = createContentService(storePort);

			await expect(
				service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
					collection: content,
					slug: "a",
					metadata: { title: "Title" },
					mdx: "Hello",
					expectedVersion: 2,
				}),
			).rejects.toBe(exactError);

			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
		});

		it("saveDraft invalid input preparation proves saveWorkingWithReferences is not called", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue([]),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			await expect(
				service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
					collection: "unknown",
					slug: "a",
					metadata: {},
					mdx: "",
				} as unknown as SaveDraftInput),
			).rejects.toBeDefined();

			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft makes an empty record slug from the slug field's `from`", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);
			await service.createDraft(
				input({ collection: recordCollection, slug: "", metadata: { title: "Hello World" }, mdx: "" }),
			);
			expect(vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0].snapshot.slug).toBe("hello-world");
		});

		it("createDraft uses exactly one atomic call, no previous refs/contentHash, exact port error propagated", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			await service.createDraft({
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				mdx: "Hello",
			});

			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).toHaveBeenCalledTimes(1);
			expect(storePort.createEntryWithReferences).toHaveBeenCalledWith(
				expect.objectContaining({
					snapshot: expect.objectContaining({ slug: "a" }),
					references: expect.any(Array),
				}),
			);

			const callArgs = vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0];
			expect(callArgs).not.toHaveProperty("previousReferences");
			expect(callArgs).not.toHaveProperty("contentHash");

			const exactError = { code: "slug_conflict", message: "Duplicate" };
			const conflictPort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn().mockRejectedValue(exactError),
				saveWorkingWithReferences: vi.fn(),
			};
			const serviceConflict = createContentService(conflictPort);

			await expect(
				serviceConflict.createDraft({
					collection: content,
					slug: "a",
					metadata: {},
					mdx: "",
				}),
			).rejects.toBe(exactError);

			await expect(
				serviceConflict.createDraft({
					collection: "unknown",
					slug: "a",
					metadata: {},
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toBeDefined();
			expect(conflictPort.createEntryWithReferences).toHaveBeenCalledTimes(1);
		});

		it("saveDraft stale behavior: passes loaded references as stale when MDX has semantic errors", async () => {
			const previousRefs: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				mdx: "</Invalid>",
				expectedVersion: 2,
			});

			expect(storePort.getWorkingReferences).toHaveBeenCalledTimes(1);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
			const savedRefs = vi.mocked(storePort.saveWorkingWithReferences).mock.calls[0][0].references;
			expect(savedRefs).toHaveLength(1);
			expect(savedRefs[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
				occurrences: [{ type: "mdx", line: 1, column: 1 }],
			});
		});

		it("saveDraft loads previous refs only for save, makes one atomic call, forwards expectedVersion", async () => {
			const previousRefs: Reference[] = [
				{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				mdx: "Hello",
				expectedVersion: 2,
			});

			expect(storePort.getWorkingReferences).toHaveBeenCalledTimes(1);
			expect(storePort.getWorkingReferences).toHaveBeenCalledWith(
				expect.objectContaining({ entryId: "123e4567-e89b-12d3-a456-426614174000" }),
			);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledWith(
				expect.objectContaining({
					entryId: "123e4567-e89b-12d3-a456-426614174000",
					expectedVersion: 2,
					snapshot: expect.objectContaining({ slug: "a" }),
					references: expect.any(Array),
				}),
			);
		});
	});

	describe("9. Exact Byte Limits & Structural Boundaries", () => {
		it("accepts exact boundary and rejects +1-byte for mdx_too_large", async () => {
			const mdxExact = "a".repeat(2097152);
			const mdxTooLarge = "a".repeat(2097153);
			await expect(
				prepareSnapshot({ collection: content, slug: "valid", metadata: {}, mdx: mdxExact }),
			).resolves.toBeDefined();
			await expect(
				prepareSnapshot({
					collection: content,
					slug: "valid",
					metadata: {},
					mdx: mdxTooLarge,
				}),
			).rejects.toMatchObject({ code: "mdx_too_large" });
		});

		it.skipIf(!unboundedText)("accepts exact boundary and rejects +1-byte for metadata_too_large", async () => {
			const name = unboundedText?.name ?? "";
			// 블로그 {"summary":""}는 14바이트다. 262144 - 14 = 262130
			const overhead = JSON.stringify({ [name]: "" }).length;
			const boundaryString = "a".repeat(262144 - overhead);
			await expect(
				prepareSnapshot(input({ collection: content, slug: "valid", metadata: { [name]: boundaryString }, mdx: "" })),
			).resolves.toBeDefined();
			const tooLargeString = "a".repeat(262144 - overhead + 1);
			await expect(
				prepareSnapshot(input({ collection: content, slug: "valid", metadata: { [name]: tooLargeString }, mdx: "" })),
			).rejects.toMatchObject({ code: "metadata_too_large" });
		});

		it.each([
			["missing slug", { collection: content, metadata: {}, mdx: "" }, "invalid_input"],
			["extra key", { collection: content, slug: "valid", metadata: {}, mdx: "", extra: 1 }, "invalid_input"],
			[
				"prototype-inherited required fields",
				Object.create(
					{ slug: "valid" },
					{
						collection: { value: content, enumerable: true },
						metadata: { value: {}, enumerable: true },
						mdx: { value: "", enumerable: true },
					},
				),
				"invalid_input",
			],
			[
				"symbol extra",
				{ collection: content, slug: "valid", metadata: {}, mdx: "", [Symbol("extra")]: 1 },
				"invalid_input",
			],
			[
				"non-enumerable extra",
				Object.defineProperty({ collection: content, slug: "valid", metadata: {}, mdx: "" }, "hidden", {
					value: 1,
					enumerable: false,
				}),
				"invalid_input",
			],
		])("rejects non-exact service inputs: %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it("prevents mutation of snapshot via caller input mutation and deep freezes snapshot", async () => {
			const ids = ["123e4567-e89b-12d3-a456-426614174001"];
			const snap = await prepareSnapshot(
				input({ collection: content, slug: "valid", metadata: { [many.name]: ids }, mdx: "" }),
			);
			const originalHash = snap.contentHash;
			const snapIds = (snap.metadata as Record<string, unknown>)[many.name];

			ids.push("123e4567-e89b-12d3-a456-426614174002");
			expect(Array.isArray(snapIds)).toBe(true);
			if (Array.isArray(snapIds)) {
				expect(snapIds).toHaveLength(1);
			}

			expect(() => {
				(snap as unknown as { mdx: string }).mdx = "changed";
			}).toThrow();
			expect(() => {
				(snap.metadata as unknown as { title: string }).title = "changed";
			}).toThrow();
			expect(() => {
				(snap.references as unknown as { push: (a: unknown) => void }).push({});
			}).toThrow();

			// Regression assertion for pushing to the many-relation array
			expect(() => {
				(snapIds as unknown as { push: (a: string) => void }).push("new-tag");
			}).toThrow();

			expect(snap.contentHash).toBe(originalHash);
			expect(snap.references).toHaveLength(1); // just tag
		});

		it("rejects metadata with symbols without executing getter", async () => {
			const meta = { title: "valid" };
			Object.defineProperty(meta, Symbol("hidden"), { value: "invalid", enumerable: true });

			await expect(
				prepareSnapshot({
					collection: content,
					slug: "valid",
					metadata: meta,
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_input" });
		});

		it("rejects metadata with getters without executing getter", async () => {
			const spy = vi.fn();
			const meta = { title: "valid" };
			Object.defineProperty(meta, unboundedText?.name ?? "summary", {
				get: spy,
				enumerable: true,
			});

			await expect(
				prepareSnapshot({
					collection: content,
					slug: "valid",
					metadata: meta,
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_input" });

			expect(spy).not.toHaveBeenCalled();
		});

		it("rejects sparse arrays in metadata", async () => {
			const sparseArray = ["123e4567-e89b-12d3-a456-426614174001"];
			delete sparseArray[0];
			await expect(
				prepareSnapshot({
					collection: content,
					slug: "valid",
					metadata: { [many.name]: sparseArray },
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_metadata_type" });
		});
	});

	describe("10. Service Input Structural & Accessor Defenses", () => {
		it("createDraft(null) rejects with ServiceError code invalid_input, not native TypeError, and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const promise = service.createDraft(null as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft custom-prototype input rejects invalid_input and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const customProtoInput = Object.create(
				{ inherited: true },
				{
					collection: { value: content, enumerable: true },
					slug: { value: "valid", enumerable: true },
					metadata: { value: {}, enumerable: true },
					mdx: { value: "", enumerable: true },
				},
			);

			const promise = service.createDraft(customProtoInput as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft top-level accessor/getter property rejects without executing getter and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const getterSpy = vi.fn(() => content);
			const inputWithGetter = {
				get collection() {
					return getterSpy();
				},
				slug: "valid",
				metadata: {},
				mdx: "",
			};

			const promise = service.createDraft(inputWithGetter as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(getterSpy).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("saveDraft null/custom-prototype input rejects invalid_input before getWorkingReferences or mutation", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const promiseNull = service.saveDraft("entry-id", null as unknown as SaveDraftInput);
			await expect(promiseNull).rejects.toThrowError(ServiceError);
			await expect(promiseNull).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();

			const customProtoInput = Object.create(
				{ inherited: true },
				{
					collection: { value: content, enumerable: true },
					slug: { value: "valid", enumerable: true },
					metadata: { value: {}, enumerable: true },
					mdx: { value: "", enumerable: true },
					expectedVersion: { value: 1, enumerable: true },
				},
			);

			const promiseProto = service.saveDraft("entry-id", customProtoInput as unknown as SaveDraftInput);
			await expect(promiseProto).rejects.toThrowError(ServiceError);
			await expect(promiseProto).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
		});

		it("saveDraft expectedVersion accessor getter rejects without executing getter or Store calls", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const getterSpy = vi.fn(() => 1);
			const inputWithGetter = {
				collection: content,
				slug: "valid",
				metadata: {},
				mdx: "",
				get expectedVersion() {
					return getterSpy();
				},
			};

			const promise = service.saveDraft("entry-id", inputWithGetter as unknown as SaveDraftInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(getterSpy).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
		});
	});
	describe("11. 이미지 소스와 발행 경고 (M8-FE-2 · A3)", () => {
		const mediaId = "987e4567-e89b-12d3-a456-426614174000";
		// 발행 필수 관계(블로그: 게시글의 `categoryId`)가 비면 발행 검사가 먼저 차단한다. 이미지 경고만 보려고
		// 필수값을 채우고 그 관계 대상은 공개된 것으로 확인해 둔다.
		const relationTargets: ResolvedTargets["targets"] = [];
		const relationTarget = async (to: Collection) => {
			const known = relationTargets.find((target) => target.collection === to);
			if (known) return known.id;
			const id = `123e4567-e89b-12d3-a456-4266141742${String(relationTargets.length).padStart(2, "0")}`;
			relationTargets.push({ id, isPublished: true, collection: to });
			return id;
		};
		const draftInput = async (mdx: string) => ({
			collection: content,
			slug: "a",
			metadata: await requiredMetadata(content, "T", relationTarget),
			mdx,
		});
		const draft = async (mdx: string) => input(await draftInput(mdx));
		/** 필수 관계 참조를 뺀 이미지(미디어) 참조. */
		const mediaReferences = (snap: PreparedSnapshot) =>
			snap.references.filter((reference) => reference.kind === "media");

		it("directive로 쓴 이미지도 미디어 참조를 수집한다", async () => {
			const snap = await prepareSnapshot(await draft(`::image{mediaId="${mediaId}" alt="설명"}`));

			expect(snap.issues).toEqual([]);
			expect(mediaReferences(snap)).toHaveLength(1);
			expect(mediaReferences(snap)[0]).toMatchObject({ kind: "media", targetId: mediaId });
			expect(snap.imageSources).toEqual([{ mediaId, position: { line: 1, column: 1 } }]);
		});

		it("외부 src는 참조가 아니고 발행을 막지 않는다", async () => {
			const snap = await prepareSnapshot(await draft('::image{src="/images/a.png"}'));

			expect(snap.issues).toEqual([]);
			expect(mediaReferences(snap)).toEqual([]);
			expect(snap.imageSources).toEqual([{ src: "/images/a.png", position: { line: 1, column: 1 } }]);
		});

		it("소스가 없는 이미지는 계속 차단한다(M7 무결성 유지)", async () => {
			const snap = await prepareSnapshot(await draft("::image{}"));

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "missing_media_id" }));
			expect(snap.imageSources).toEqual([]);
		});

		it("허용되지 않는 src는 비차단 경고다(ready 유지)", async () => {
			const snap = await prepareSnapshot(await draft('::image{src="javascript:alert(1)"}'));
			const validation = validateForPublish(snap, { targets: relationTargets, media: [] });

			expect(validation.ready).toBe(true);
			expect(validation.warnings).toEqual([
				expect.objectContaining({ code: "image_src_not_allowed", position: { line: 1, column: 1 } }),
			]);
		});

		it("미디어 상태·저장소 키로 경고를 만들고, 행이 없으면 경고하지 않는다", async () => {
			const snap = await prepareSnapshot(await draft(`::image{mediaId="${mediaId}"}`));
			const targets = relationTargets;

			expect(validateForPublish(snap, { targets, media: [{ id: mediaId, status: "pending" }] }).warnings).toEqual([
				expect.objectContaining({ code: "image_media_not_ready", message: "pending" }),
			]);
			expect(
				validateForPublish(snap, { targets, media: [{ id: mediaId, status: "ready", storageKey: null }] }).warnings,
			).toEqual([expect.objectContaining({ code: "image_media_unresolved" })]);
			expect(
				validateForPublish(snap, { targets, media: [{ id: mediaId, status: "ready", storageKey: "k/a.png" }] })
					.warnings,
			).toEqual([]);

			// 미디어 행이 아예 없는 경우는 경고 대상이 아니다 — 참조 확인이 먼저 차단한다.
			const missing = validateForPublish(snap, { targets, media: [] });
			expect(missing.warnings).toEqual([]);
			expect(missing.ready).toBe(false);
			expect(missing.issues).toContainEqual(expect.objectContaining({ code: "unresolved_media" }));
		});

		it("발행 응답용 경고는 DB 상태와 저장소 실물을 함께 본다", async () => {
			const publishInput = {
				...(await draftInput(`::image{mediaId="${mediaId}"}`)),
				getMediaAsset: async () => ({ status: "pending", storageKey: null }),
			};

			expect(await imageWarningsForPublish(publishInput)).toEqual([
				expect.objectContaining({ code: "image_media_not_ready", message: "pending" }),
			]);
			expect(
				await imageWarningsForPublish({
					...publishInput,
					getMediaAsset: async () => ({ status: "ready", storageKey: "k/a.png" }),
					headStorageKey: async () => true,
				}),
			).toEqual([]);
			expect(
				await imageWarningsForPublish({
					...publishInput,
					getMediaAsset: async () => ({ status: "ready", storageKey: "k/a.png" }),
					headStorageKey: async () => false,
				}),
			).toEqual([expect.objectContaining({ code: "image_media_missing_in_storage", message: "k/a.png" })]);
		});

		it("경고 계산은 발행을 막지 않는다(실패 시 빈 배열)", async () => {
			const warnings = await imageWarningsForPublish({
				...(await draftInput(`::image{mediaId="${mediaId}"}`)),
				getMediaAsset: async () => {
					throw new Error("db down");
				},
			});

			expect(warnings).toEqual([]);
		});
	});
});

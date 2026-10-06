import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	contentCollection,
	otherContentCollection,
	recordCollection,
	requiredMetadata,
	titleFieldOf,
} from "../../../test/any-site";
import { docOf } from "../../../test/stored-content";
import { COLLECTIONS, type Collection, DOCUMENT_COLLECTIONS } from "../../core/collections";
import { isBlockId } from "../../doc/block-ids";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import { type StoredField, storedFields } from "../../schema/derive";
import { isRequiredField } from "../../schema/fields";
import type { PreparedSnapshot, Reference, ResolvedTargets, SaveDraftInput, ServiceInput, StorePort } from "../index";
import {
	createContentService as createCoreContentService,
	imageWarningsForSnapshot,
	prepareSnapshot as prepareCoreSnapshot,
	ServiceError,
	validateForPublish,
} from "../index";

/** Bodies given as text are read by the plain test format (core has no text format of its own). */
const formats = async () => createFormatRegistry([paragraphsFormat]);
const prepareSnapshot = (
	value: Parameters<typeof prepareCoreSnapshot>[0],
	options: Parameters<typeof prepareCoreSnapshot>[1] = {},
) => prepareCoreSnapshot(value, { ...options, import: { formats: createFormatRegistry([paragraphsFormat]) } });
const createContentService = ((port: Parameters<typeof createCoreContentService>[0], options = {}) =>
	createCoreContentService(port, { formats, ...options })) as typeof createCoreContentService;

/*
 * Collection and field names are looked up from the current config. In the reference blog setup, the body collection is posts (`post`),
 * the single-value relation is `categoryId` (→ category), the multi-value relation is `tagIds` (→ tag), and the second collection is memos (`memo`).
 */
const content = contentCollection;
/** Stored fields that are not dependent on a conditional field. */
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
/** The second collection (blog: memo). If there is only one document collection with a body, the first item collection. */
const second = otherContentCollection ?? recordCollection;
/** A text field with no character limit (blog: summary `summary`). Tests the metadata size limit. */
const unboundedText = topLevel(content).find(
	({ name, field }) => name !== "title" && field.kind === "text" && field.max === undefined,
);
/** A list relation that also holds not-yet-published posts in order (blog: collection `itemIds` of `collection`). */
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
/** A collection that a list relation cannot hold (blog: memo). */
const notListable = [...DOCUMENT_COLLECTIONS, ...COLLECTIONS].find((name) => name !== orderedList?.to) as Collection;

/** Builds inputs whose type differs per collection, using names found in the config. */
const input = (value: {
	collection: Collection;
	slug: string | null;
	metadata: Record<string, unknown>;
	format: string;
	body: string;
}): ServiceInput => value as unknown as ServiceInput;

/** Metadata with every stored field of the collection filled. A select field uses the first option, and the conditional fields dependent on that value are filled too. */
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

describe("ContentService Contract", () => {
	describe("1. Metadata Allowlists & Collection Rules", () => {
		it.each([
			[
				"unknown collection",
				{ collection: "unknown", slug: "test", metadata: {}, format: "paragraphs", body: "" },
				"unknown_collection",
			],
			[
				"content with wrong title type",
				{ collection: content, slug: "valid", metadata: { title: 123 }, format: "paragraphs", body: "" },
				"invalid_metadata_type",
			],
			[
				"content with wrong many-relation type",
				{ collection: content, slug: "valid", metadata: { [many.name]: "tag-1" }, format: "paragraphs", body: "" },
				"invalid_metadata_type",
			],
			[
				"non-JSON value in title",
				{ collection: content, slug: "valid", metadata: { title: () => {} }, format: "paragraphs", body: "" },
				"invalid_metadata_type",
			],
			[
				"a key that is not in the schema and that the entry does not already hold",
				{ collection: recordCollection, slug: "valid", metadata: { index: "1" }, format: "paragraphs", body: "" },
				"invalid_metadata_key",
			],
			[
				"a removed field named like an object prototype",
				{
					collection: content,
					slug: "valid",
					metadata: JSON.parse('{"__proto__":"x"}'),
					format: "paragraphs",
					body: "",
				},
				"invalid_metadata_key",
			],
		] satisfies Array<[string, unknown, string]>)("rejects %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it.each(
			COLLECTIONS.map((collection) => [
				collection,
				input({ collection, slug: "s", metadata: canonicalMetadata(collection), format: "paragraphs", body: "" }),
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
				format: "paragraphs",
				body: "",
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
				format: "paragraphs",
				body: "",
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
				prepareSnapshot({ collection: content, slug: inputSlug, metadata: {}, format: "paragraphs", body: "" }),
			).rejects.toMatchObject({ code: "invalid_slug_format" });
		});

		it("accepts exactly 200 Unicode code points and rejects 201", async () => {
			const slug200 = "😀".repeat(200);
			const slug201 = "😀".repeat(201);
			const result = await prepareSnapshot({
				collection: content,
				slug: slug200,
				metadata: {},
				format: "paragraphs",
				body: "",
			});
			expect(result.slug).toBe(slug200);
			await expect(
				prepareSnapshot({ collection: content, slug: slug201, metadata: {}, format: "paragraphs", body: "" }),
			).rejects.toMatchObject({ code: "slug_too_long" });
		});

		it.skipIf(titleFieldOf(content).max === undefined)(
			"accepts exactly the title field's max Unicode code points and rejects one more",
			async () => {
				const { max = 0, label } = titleFieldOf(content);
				const titleMax = "😀".repeat(max);
				const titleOver = "😀".repeat(max + 1);
				const result = await prepareSnapshot(
					input({ collection: content, slug: "valid", metadata: { title: titleMax }, format: "paragraphs", body: "" }),
				);
				expect(result.metadata.title).toBe(titleMax);
				await expect(
					prepareSnapshot(
						input({
							collection: content,
							slug: "valid",
							metadata: { title: titleOver },
							format: "paragraphs",
							body: "",
						}),
					),
				).rejects.toMatchObject({
					code: "field_too_long",
					issues: [{ code: "field_too_long", path: "title", message: label }],
				});
			},
		);

		it("allows equal slug in two different collection inputs", async () => {
			const result1 = await prepareSnapshot({
				collection: content,
				slug: "shared-slug",
				metadata: {},
				format: "paragraphs",
				body: "",
			});
			const result2 = await prepareSnapshot(
				input({ collection: second, slug: "shared-slug", metadata: {}, format: "paragraphs", body: "" }),
			);
			expect(result1.slug).toBe("shared-slug");
			expect(result2.slug).toBe("shared-slug");
		});
	});

	describe("3. Deterministic Hashing", () => {
		it("computes the SHA-256 vector with key-order equivalence and metadata/MDX/schema changes", async () => {
			const ids = ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"];
			const snapshotOf = (metadata: Record<string, unknown>, mdx = "Hello", schemaVersion = 1) =>
				prepareSnapshot(input({ collection: content, slug: "a", metadata, format: "paragraphs", body: mdx }), {
					schemaVersion,
				});
			const snap1 = await snapshotOf({ title: "A", [many.name]: ids });
			const snap2 = await snapshotOf({ [many.name]: ids, title: "A" });

			// Metadata keys are hashed in name order.
			const sortedMetadata = Object.fromEntries(
				Object.entries({ title: "A", [many.name]: ids }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
			);
			// The body is hashed as its stored document (keys sorted, with its format version), not as the MDX string.
			const helloDocument = {
				content: [{ content: [{ text: "Hello", type: "text" }], type: "paragraph" }],
				type: "doc",
				version: 2,
			};
			const expectedTuple = ["cms-snapshot-v3", 1, sortedMetadata, helloDocument];
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
				format: "paragraphs",
				body: "Hello",
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
				format: "paragraphs",
				body: "",
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
					format: "paragraphs",
					body: "",
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

		const imageOf = (attrs: Record<string, unknown>) => ({ type: "image", attrs });
		const docOfBlocks = (...content: unknown[]) => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });

		it("extracts ordered/deduplicated refs with occurrences from Image", async () => {
			const first = "123e4567-e89b-12d3-a456-426614174000";
			const second = "987e4567-e89b-12d3-a456-426614174000";
			const doc = docOfBlocks(imageOf({ mediaId: first }), imageOf({ mediaId: second }), imageOf({ mediaId: first }));
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, doc } as never);
			expect(snap.references).toHaveLength(2);

			expect(snap.references[0]).toMatchObject({ kind: "media", targetId: first, isStale: false });
			expect(snap.references[0].occurrences).toHaveLength(2);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "body" });

			expect(snap.references[1]).toMatchObject({ kind: "media", targetId: second, isStale: false });
			expect(snap.references[1].occurrences).toHaveLength(1);
			// Each image is a block of its own, and the occurrence names it.
			const ids = snap.doc.content.map((block) => block.id);
			expect(snap.references[0].occurrences).toEqual([
				{ type: "body", blockId: ids[0] },
				{ type: "body", blockId: ids[2] },
			]);
			expect(snap.references[1].occurrences[0]).toEqual({ type: "body", blockId: ids[1] });
		});

		it.each([
			["an empty media id", { type: "image", attrs: { mediaId: "", alt: "a" } }, "missing_media_id"],
			["no source at all", { type: "image", attrs: { alt: "a" } }, "missing_media_id"],
			["a media id that is not text", { type: "image", attrs: { mediaId: 5, alt: "a" } }, "invalid_reference_id"],
			["a file with no media id", { type: "file", attrs: { label: "x" } }, "missing_media_id"],
		])("flags a document that holds %s", async (_name, block, expectedIssue) => {
			const doc = { type: "doc", version: 2, content: [block] };
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, doc });
			expect(snap.issues).toContainEqual(
				expect.objectContaining({ code: expectedIssue, position: { blockId: snap.doc.content[0]?.id } }),
			);
			expect(snap.references).toEqual([]);
		});

		it.each([
			["an image", imageOf({ mediaId: "987e4567-e89b-12d3-a456-426614174000", alt: "a" })],
			["a file", { type: "file", attrs: { mediaId: "987e4567-e89b-12d3-a456-426614174000" } }],
		])("records a media reference for a registered media ID: %s", async (_name, block) => {
			const snap = await prepareSnapshot({
				collection: content,
				slug: "a",
				metadata: {},
				doc: docOfBlocks(block),
			} as never);
			expect(snap.issues).toEqual([]);
			expect(snap.references).toEqual([
				{
					kind: "media",
					targetId: "987e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					// The body is one block, and the position names it.
					occurrences: [{ type: "body", blockId: snap.doc.content[0]?.id }],
				},
			]);
			expect(snap.doc.content).toHaveLength(1);
		});

		it("does not reference an external image src", async () => {
			const snap = await prepareSnapshot({
				collection: content,
				slug: "a",
				metadata: {},
				doc: docOfBlocks(imageOf({ src: "https://example.com/a.png", alt: "a" })),
			} as never);
			expect(snap.issues).toEqual([]);
			expect(snap.references).toEqual([]);
			expect(snap.imageSources).toEqual([
				{ src: "https://example.com/a.png", position: { blockId: snap.doc.content[0]?.id } },
			]);
		});

		it("retains trusted previous refs marked stale when the text cannot be read and keeps the exact text unchanged", async () => {
			const text = "<<<Invalid";
			const previousReferences: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "body", blockId: "abcd1234" }],
				},
			];
			const snap = await prepareSnapshot(
				{ collection: content, slug: "a", metadata: {}, format: "paragraphs", body: text },
				{ previousReferences },
			);

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "bad_marker" }));
			// The text is kept as it was given, in an unparsed body.
			expect(snap.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "paragraphs", source: text } }),
			]);
			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "unparsed_body" }));
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});

		it("retains trusted previous refs marked stale when the body holds a reference problem", async () => {
			const doc = { type: "doc", version: 2, content: [{ type: "image", attrs: { alt: "a" } }] };
			const previousReferences: Reference[] = [
				{
					kind: "media",
					targetId: "987e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "body", blockId: "abcd1234" }],
				},
			];
			const snap = await prepareSnapshot({ collection: content, slug: "a", metadata: {}, doc }, { previousReferences });

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "missing_media_id" }));
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "media",
				targetId: "987e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});
	});

	describe("5. Publish validation tables", () => {
		const validSnap = {
			collection: content,
			slug: "valid-post",
			metadata: {
				title: "Title",
				[single.name]: "123e4567-e89b-12d3-a456-426614174001",
				[many.name]: ["123e4567-e89b-12d3-a456-426614174002"],
			},
			doc: docOf("Content"),
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
			["empty body", { ...validSnap, doc: docOf("") }, validResolvedTargets, "empty_body"],
			// Only when the single-value relation is required for publishing (blog: category).
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
				"issues of the body",
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

	// Only for configs that have a list relation that also holds not-yet-published posts in order (blog: collection `itemIds`).
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
					format: "paragraphs",
					body: "",
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
				format: "paragraphs",
				body: "",
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
				format: "paragraphs",
				body: "",
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
					format: "paragraphs",
					body: "",
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
				input({
					collection: content,
					slug: "memo",
					metadata: { title: "Memo", [many.name]: ids },
					format: "paragraphs",
					body: "Body",
				}),
			);
			const validation = validateForPublish(snapshot, { targets: [], media: [] });
			expect(validation.issues.filter((issue) => issue.code === "unresolved_reference")).toEqual([
				expect.objectContaining({ path: many.name, ordinal: 0 }),
				expect.objectContaining({ path: many.name, ordinal: 1 }),
			]);
		});
	});

	describe("9. Service Orchestration & Fake Port", () => {
		it("saveDraft propagates the exact save port rejection", async () => {
			const exactError = { code: "concurrent_modification", message: "Conflict" };
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue([]),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn().mockResolvedValue({ doc: null }),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockRejectedValue(exactError),
			};
			const service = createContentService(storePort);

			await expect(
				service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
					collection: content,
					slug: "a",
					metadata: { title: "Title" },
					format: "paragraphs",
					body: "Hello",
					expectedVersion: 2,
				}),
			).rejects.toBe(exactError);
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
					format: "paragraphs",
					body: "",
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
				input({
					collection: recordCollection,
					slug: "",
					metadata: { title: "Hello World" },
					format: "paragraphs",
					body: "",
				}),
			);
			expect(vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0].snapshot.slug).toBe("hello-world");
		});

		it("createDraft stores through the atomic create call without previous refs/contentHash, and propagates the exact port error", async () => {
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
				format: "paragraphs",
				body: "Hello",
			});

			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
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
					format: "paragraphs",
					body: "",
				}),
			).rejects.toBe(exactError);

			vi.mocked(conflictPort.createEntryWithReferences).mockClear();
			await expect(
				serviceConflict.createDraft({
					collection: "unknown",
					slug: "a",
					metadata: {},
					format: "paragraphs",
					body: "",
				} as unknown as ServiceInput),
			).rejects.toBeDefined();
			expect(conflictPort.createEntryWithReferences).not.toHaveBeenCalled();
		});

		it("saveDraft stale behavior: passes loaded references as stale when the text cannot be read", async () => {
			const previousRefs: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "body", blockId: "abcd1234" }],
				},
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn().mockResolvedValue({ doc: null }),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				format: "paragraphs",
				body: "<<<Invalid",
				expectedVersion: 2,
			});

			const savedRefs = vi.mocked(storePort.saveWorkingWithReferences).mock.calls[0][0].references;
			expect(savedRefs).toHaveLength(1);
			expect(savedRefs[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
				occurrences: [{ type: "body", blockId: "abcd1234" }],
			});
		});

		it("saveDraft loads previous refs for the entry and forwards expectedVersion to the atomic save", async () => {
			const previousRefs: Reference[] = [
				{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				archiveEntry: vi.fn(),
				unarchiveEntry: vi.fn(),
				trashEntry: vi.fn(),
				publishEntry: vi.fn(),
				getWorking: vi.fn().mockResolvedValue({ doc: null }),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				format: "paragraphs",
				body: "Hello",
				expectedVersion: 2,
			});

			expect(storePort.getWorkingReferences).toHaveBeenCalledWith(
				expect.objectContaining({ entryId: "123e4567-e89b-12d3-a456-426614174000" }),
			);
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

	describe("9. Block ids", () => {
		const entryId = "123e4567-e89b-12d3-a456-426614174000";
		const portWith = (doc: StoredDocument | null): StorePort => ({
			getWorkingReferences: vi.fn().mockResolvedValue([]),
			archiveEntry: vi.fn(),
			unarchiveEntry: vi.fn(),
			trashEntry: vi.fn(),
			publishEntry: vi.fn(),
			getWorking: vi.fn().mockResolvedValue({ doc }),
			createEntryWithReferences: vi.fn(),
			saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
		});
		const saveWith = (storePort: StorePort, body: { format: string; body: string } | { doc: StoredDocument }) =>
			createContentService(storePort).saveDraft(entryId, {
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				expectedVersion: 2,
				...body,
			} as SaveDraftInput);
		const savedDoc = (storePort: StorePort) =>
			vi.mocked(storePort.saveWorkingWithReferences).mock.calls[0]?.[0].snapshot.doc as StoredDocument;
		const idsOf = (doc: StoredDocument) => doc.content.map((block) => block.id);

		it("saveDraft reads the current draft and pairs the new text with its document, so blocks keep their ids", async () => {
			const current = docOf("One\n\nTwo\n\nThree\n");
			const storePort = portWith(current);

			await saveWith(storePort, { format: "paragraphs", body: "One\n\nTwo reworded\n\nThree\n" });

			expect(storePort.getWorking).toHaveBeenCalledWith({ entryId });
			expect(idsOf(savedDoc(storePort))).toEqual(idsOf(current));
		});

		it("saveDraft gives new ids when the current draft has no document", async () => {
			const storePort = portWith(null);

			await saveWith(storePort, { format: "paragraphs", body: "One\n\nTwo\n" });

			const ids = idsOf(savedDoc(storePort));
			expect(ids).toHaveLength(2);
			expect(ids.every(isBlockId)).toBe(true);
			expect(new Set(ids).size).toBe(2);
		});

		it("saveDraft keeps the ids of a document it is sent, not those of the current draft", async () => {
			const current = docOf("One\n\nTwo\n");
			const sent: StoredDocument = {
				...current,
				content: current.content.map((block, index) => ({ ...block, id: `sent000${index}` })),
			};
			const storePort = portWith(current);

			await saveWith(storePort, { doc: sent });

			expect(idsOf(savedDoc(storePort))).toEqual(["sent0000", "sent0001"]);
		});

		it("createDraft gives every block of the body an id of its own", async () => {
			const storePort = portWith(null);

			await createContentService(storePort).createDraft({
				collection: content,
				slug: "a",
				metadata: { title: "Title" },
				format: "paragraphs",
				body: "One\n\nTwo\n",
			} as ServiceInput);

			const doc = vi.mocked(storePort.createEntryWithReferences).mock.calls[0]?.[0].snapshot.doc as StoredDocument;
			expect(idsOf(doc).every(isBlockId)).toBe(true);
			expect(new Set(idsOf(doc)).size).toBe(2);
		});
	});

	describe("9. Exact Byte Limits & Structural Boundaries", () => {
		it("accepts exact boundary and rejects +1-byte for body_too_large", async () => {
			const mdxExact = "a".repeat(2097152);
			const mdxTooLarge = "a".repeat(2097153);
			await expect(
				prepareSnapshot({ collection: content, slug: "valid", metadata: {}, format: "paragraphs", body: mdxExact }),
			).resolves.toBeDefined();
			await expect(
				prepareSnapshot({
					collection: content,
					slug: "valid",
					metadata: {},
					format: "paragraphs",
					body: mdxTooLarge,
				}),
			).rejects.toMatchObject({ code: "body_too_large" });
		});

		it.skipIf(!unboundedText)("accepts exact boundary and rejects +1-byte for metadata_too_large", async () => {
			const name = unboundedText?.name ?? "";
			// The reference blog's {"summary":""} is 14 bytes. 262144 - 14 = 262130
			const overhead = JSON.stringify({ [name]: "" }).length;
			const boundaryString = "a".repeat(262144 - overhead);
			await expect(
				prepareSnapshot(
					input({
						collection: content,
						slug: "valid",
						metadata: { [name]: boundaryString },
						format: "paragraphs",
						body: "",
					}),
				),
			).resolves.toBeDefined();
			const tooLargeString = "a".repeat(262144 - overhead + 1);
			await expect(
				prepareSnapshot(
					input({
						collection: content,
						slug: "valid",
						metadata: { [name]: tooLargeString },
						format: "paragraphs",
						body: "",
					}),
				),
			).rejects.toMatchObject({ code: "metadata_too_large" });
		});

		it.each([
			["missing slug", { collection: content, metadata: {}, format: "paragraphs", body: "" }, "invalid_input"],
			[
				"extra key",
				{ collection: content, slug: "valid", metadata: {}, format: "paragraphs", body: "", extra: 1 },
				"invalid_input",
			],
			[
				"prototype-inherited required fields",
				Object.create(
					{ slug: "valid" },
					{
						collection: { value: content, enumerable: true },
						metadata: { value: {}, enumerable: true },
						body: { value: "", enumerable: true },
						format: { value: "mdx", enumerable: true },
					},
				),
				"invalid_input",
			],
			[
				"symbol extra",
				{ collection: content, slug: "valid", metadata: {}, format: "paragraphs", body: "", [Symbol("extra")]: 1 },
				"invalid_input",
			],
			[
				"non-enumerable extra",
				Object.defineProperty(
					{ collection: content, slug: "valid", metadata: {}, format: "paragraphs", body: "" },
					"hidden",
					{
						value: 1,
						enumerable: false,
					},
				),
				"invalid_input",
			],
		])("rejects non-exact service inputs: %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it("prevents mutation of snapshot via caller input mutation and deep freezes snapshot", async () => {
			const ids = ["123e4567-e89b-12d3-a456-426614174001"];
			const snap = await prepareSnapshot(
				input({ collection: content, slug: "valid", metadata: { [many.name]: ids }, format: "paragraphs", body: "" }),
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
					format: "paragraphs",
					body: "",
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
					format: "paragraphs",
					body: "",
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
					format: "paragraphs",
					body: "",
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
				format: "paragraphs",
				body: "",
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
				format: "paragraphs",
				body: "",
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
	describe("11. image sources and publish warnings", () => {
		const mediaId = "987e4567-e89b-12d3-a456-426614174000";
		// If the required relation for publishing (blog: a post's `categoryId`) is empty, the publish check blocks first. To look only at image warnings,
		// fill in the required value and confirm that the relation target is public.
		const relationTargets: ResolvedTargets["targets"] = [];
		const relationTarget = async (to: Collection) => {
			const known = relationTargets.find((target) => target.collection === to);
			if (known) return known.id;
			const id = `123e4567-e89b-12d3-a456-4266141742${String(relationTargets.length).padStart(2, "0")}`;
			relationTargets.push({ id, isPublished: true, collection: to });
			return id;
		};
		const draftInput = async (body: string) => ({
			collection: content,
			slug: "a",
			metadata: await requiredMetadata(content, "T", relationTarget),
			format: "paragraphs",
			body,
		});
		/** A write of a body that is one image block (the attributes a text cannot say). */
		const draft = async (attrs: Record<string, unknown>) => {
			const { body: _body, format: _format, ...fields } = await draftInput("");
			return {
				...fields,
				doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [{ type: "image", attrs }] },
			} as unknown as ServiceInput;
		};
		/** Image (media) references excluding the required relation reference. */
		const mediaReferences = (snap: PreparedSnapshot) =>
			snap.references.filter((reference) => reference.kind === "media");

		it("collects media references for the images of the body", async () => {
			const snap = await prepareSnapshot(await draft({ mediaId, alt: "설명" }));

			expect(snap.issues).toEqual([]);
			expect(mediaReferences(snap)).toHaveLength(1);
			expect(mediaReferences(snap)[0]).toMatchObject({ kind: "media", targetId: mediaId });
			expect(snap.imageSources).toEqual([{ mediaId, position: { blockId: snap.doc.content[0]?.id } }]);
		});

		it("an external src is not a reference and does not block publishing", async () => {
			const snap = await prepareSnapshot(await draft({ src: "/images/a.png", alt: "a" }));

			expect(snap.issues).toEqual([]);
			expect(mediaReferences(snap)).toEqual([]);
			expect(snap.imageSources).toEqual([{ src: "/images/a.png", position: { blockId: snap.doc.content[0]?.id } }]);
		});

		it("an image with no source stays blocked", async () => {
			const { body: _text, format: _format, ...fields } = await draftInput("");
			const snap = await prepareSnapshot({
				...fields,
				doc: { type: "doc", version: 2, content: [{ type: "image", attrs: { alt: "a" } }] },
			} as never);

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "missing_media_id" }));
			expect(snap.imageSources).toEqual([]);
		});

		it("a disallowed src is a non-blocking warning (stays ready)", async () => {
			const snap = await prepareSnapshot(await draft({ src: "javascript:alert(1)", alt: "a" }));
			const validation = validateForPublish(snap, { targets: relationTargets, media: [] });

			expect(validation.ready).toBe(true);
			expect(validation.warnings).toEqual([
				expect.objectContaining({ code: "image_src_not_allowed", position: { blockId: snap.doc.content[0]?.id } }),
			]);
		});

		it("builds warnings from media status and storage key, and does not warn when there is no row", async () => {
			const snap = await prepareSnapshot(await draft({ mediaId }));
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

			// A media row that does not exist at all is not a warning case — the reference check blocks first.
			const missing = validateForPublish(snap, { targets, media: [] });
			expect(missing.warnings).toEqual([]);
			expect(missing.ready).toBe(false);
			expect(missing.issues).toContainEqual(expect.objectContaining({ code: "unresolved_media" }));
		});

		it("the warning for the publish response looks at both the DB state and the actual storage object", async () => {
			const snapshot = await prepareSnapshot(await draft({ mediaId }));
			const pending = { getMediaAsset: async () => ({ status: "pending", storageKey: null }) };

			expect(await imageWarningsForSnapshot(snapshot, pending)).toEqual([
				expect.objectContaining({ code: "image_media_not_ready", message: "pending" }),
			]);
			expect(
				await imageWarningsForSnapshot(snapshot, {
					getMediaAsset: async () => ({ status: "ready", storageKey: "k/a.png" }),
					headStorageKey: async () => true,
				}),
			).toEqual([]);
			expect(
				await imageWarningsForSnapshot(snapshot, {
					getMediaAsset: async () => ({ status: "ready", storageKey: "k/a.png" }),
					headStorageKey: async () => false,
				}),
			).toEqual([expect.objectContaining({ code: "image_media_missing_in_storage", message: "k/a.png" })]);
		});

		it("warning computation does not block publishing (empty array on failure)", async () => {
			const warnings = await imageWarningsForSnapshot(await prepareSnapshot(await draft({ mediaId })), {
				getMediaAsset: async () => {
					throw new Error("db down");
				},
			});

			expect(warnings).toEqual([]);
		});
	});
});

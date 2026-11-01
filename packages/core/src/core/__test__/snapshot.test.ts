import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, requiredMetadata } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf, docOf as docOfText } from "../../../test/stored-content";
import { defineCollection, defineSite, fields } from "../..";
import { entryLinkHref, linkMarkAttrs, mapLinkAttrs } from "../../doc/entry-links";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { RECORD_TRANSLATIONS_KEY } from "../../schema/fields";
import { createSite } from "../../site";
import type { Collection } from "../collections";
import { MAX_DOC_BYTES, MAX_TEXT_BYTES } from "../limits";
import { documentInputBody, prepareSnapshot, validateForPublish } from "../snapshot";
import type { ServiceInput } from "../types";

const inputWith = (doc: unknown) => ({ collection: contentCollection, slug: null, metadata: {}, doc }) as ServiceInput;
const read = (doc: unknown) => documentInputBody(testSite, inputWith(doc), null);

/** A stored document of `count` paragraphs of `words` words: big as JSON for few nodes. */
const docOfSize = (count: number, words: number) => {
	const paragraph = { type: "paragraph", content: [{ type: "text", text: "word ".repeat(words).trim() }] };
	return { type: "doc", version: 3, content: Array.from({ length: count }, () => paragraph) };
};

describe("documentInputBody", () => {
	it("WRITE-S7 refuses a value that is not a stored document as invalid_input", () => {
		const circular: Record<string, unknown> = { type: "doc", version: 3, content: [] };
		circular.self = circular;
		const notDocuments: unknown[] = [
			{ ...docOf("Body"), version: 999 },
			{ type: "doc", version: 3, content: "not a list" },
			{ type: "doc", version: 3 },
			{ type: "paragraph" },
			"text",
			42,
			null,
			[],
			circular,
		];
		for (const value of notDocuments) {
			expect(() => read(value), String(value)).toThrow(expect.objectContaining({ code: "invalid_input" }));
		}
	});

	it("WRITE-S7 refuses a document over the document limit as body_too_large, and takes one over the text limit", () => {
		const tooLarge = {
			type: "doc",
			version: 3,
			content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(MAX_DOC_BYTES) }] }],
		};
		expect(() => read(tooLarge)).toThrow(expect.objectContaining({ code: "body_too_large" }));

		const overTextLimit = docOfSize(5_200, 72);
		const bytes = Buffer.byteLength(JSON.stringify(overTextLimit));
		expect(bytes).toBeGreaterThan(MAX_TEXT_BYTES);
		expect(bytes).toBeLessThan(MAX_DOC_BYTES);
		expect(read(overTextLimit).doc.content).toHaveLength(5_200);
	});
});

describe("checking links by entry id", () => {
	const ID = "123e4567-e89b-42d3-a456-426614174000";

	/** The text read by the test reader, with a link to `entry:<id>` made an entry link, as a format that knows the notation writes it. */
	const docOf = (text: string): StoredDocument => {
		const doc = docOfText(text);
		const content = mapLinkAttrs(doc.content, (attrs) =>
			typeof attrs.href === "string"
				? linkMarkAttrs(attrs.href, typeof attrs.title === "string" ? attrs.title : null)
				: undefined,
		);
		return { ...doc, content: content as CmsNode[] };
	};

	/** A write of a body given as a document (the text read by the test reader). */
	const input = async (text: string): Promise<ServiceInput> =>
		({
			collection: contentCollection,
			slug: "entry",
			metadata: await requiredMetadata(contentCollection, "Post", async () => "00000000-0000-4000-8000-000000000009"),
			doc: docOf(text),
		}) as ServiceInput;

	it("WRITE-P1 records one reference per target, with the block of every link, and no href check for it", async () => {
		const snapshot = await prepareSnapshot(
			testSite,
			await input(`One [a](${entryLinkHref(ID)}).\n\nTwo [b](${entryLinkHref(ID)}).`),
		);

		const reference = snapshot.references.find((ref) => ref.kind === "entry" && ref.targetId === ID);
		expect(reference?.occurrences).toHaveLength(2);
		expect(reference?.occurrences.every((o) => o.type === "body" && typeof o.blockId === "string")).toBe(true);
		expect(new Set(reference?.occurrences.map((o) => (o.type === "body" ? o.blockId : "")))).toHaveProperty("size", 2);
		expect(snapshot.internalLinks).toEqual([]);
	});

	it("WRITE-P1 publishing reports a target that is gone, unpublished, a translation or not linkable with the link codes, at the link's block", async () => {
		const snapshot = await prepareSnapshot(testSite, await input(`[a](${entryLinkHref(ID)})`));
		const blockId = snapshot.references.find((ref) => ref.targetId === ID)?.occurrences.find((o) => o.type === "body");
		const result = (target: Parameters<typeof validateForPublish>[2]["targets"][number] | undefined) =>
			validateForPublish(testSite, snapshot, { targets: target ? [target] : [], media: [] });
		const codes = (target: Parameters<typeof validateForPublish>[2]["targets"][number] | undefined) =>
			result(target).issues.filter((issue) => issue.code.endsWith("internal_link"));

		expect(codes(undefined).map((issue) => issue.code)).toEqual(["unresolved_internal_link"]);
		// A target that is not published is a warning, at the link's block: it does not block publishing (the link is plain text until the target is published).
		const unpublished = result({ id: ID, collection: contentCollection, isPublished: false });
		expect(unpublished.issues.filter((issue) => issue.code.endsWith("internal_link"))).toEqual([]);
		expect(unpublished.warnings.filter((issue) => issue.code === "unpublished_internal_link")).toEqual([
			expect.objectContaining({ position: blockId?.type === "body" ? { blockId: blockId.blockId } : {} }),
		]);
		expect(
			codes({ id: ID, collection: contentCollection, isPublished: true, isSource: false }).map((i) => i.code),
		).toEqual(["unresolved_internal_link"]);
		expect(codes({ id: ID, collection: contentCollection, isPublished: true, isSource: true })).toEqual([]);
		expect(codes(undefined)[0]?.position).toEqual(
			blockId && blockId.type === "body" ? { blockId: blockId.blockId } : {},
		);
	});
});

describe("publish validation of images", () => {
	it("WRITE-P1 blocks publishing an image without alt", async () => {
		// The required-attribute checks for blog-specific blocks (tabs, tooltip, alignment) live in `snapshot.blog.test.ts`.
		const doc = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [{ type: "image", attrs: { mediaId: "11111111-1111-4111-8111-111111111111" } }],
		};
		const snapshot = await prepareSnapshot(testSite, {
			collection: contentCollection,
			slug: "m",
			metadata: { title: "m" },
			doc,
		} as never);
		const result = validateForPublish(testSite, snapshot, {
			targets: [],
			media: [{ id: "11111111-1111-4111-8111-111111111111" }],
		});
		expect(result.ready).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain("missing_image_alt");
	});
});

describe("what a removed field or option leaves behind", () => {
	/** A key no config has a field for (what a removed field leaves behind), and an option no select lists (what a removed option leaves behind). */
	const ORPHAN = "removedField";
	const UNKNOWN_OPTION = "removed-option";
	const select = testSite.storedFields(contentCollection).find(({ field, when }) => !when && field.kind === "select");

	const targets: { id: string; isPublished: boolean; collection: Collection }[] = [];
	const relationTarget = async (to: Collection) => {
		const known = targets.find((target) => target.collection === to);
		if (known) return known.id;
		const id = `123e4567-e89b-12d3-a456-4266141742${String(targets.length).padStart(2, "0")}`;
		targets.push({ id, isPublished: true, collection: to });
		return id;
	};

	const draft = async (extra: Record<string, unknown> = {}) =>
		({
			collection: contentCollection,
			slug: "a",
			metadata: { ...(await requiredMetadata(contentCollection, "T", relationTarget)), ...extra },
			doc: docOf("Body"),
		}) as unknown as ServiceInput;

	/** Prepares an input for an entry that already holds exactly these keys: a save of stored metadata. */
	const prepareHeld = (input: ServiceInput) =>
		prepareSnapshot(testSite, input, { previousMetadata: input.metadata as Record<string, unknown> });

	describe("values of removed fields", () => {
		it("WRITE-S8 keeps an unknown key only when the entry already holds it, and rejects the other new ones beside it", async () => {
			const input = await draft({ [ORPHAN]: "left" });
			const kept = await prepareSnapshot(testSite, input, { previousMetadata: { [ORPHAN]: "older value" } });
			expect(kept.metadata[ORPHAN]).toBe("left");
			await expect(
				prepareSnapshot(testSite, await draft({ [ORPHAN]: "left", titel: "typo" }), {
					previousMetadata: { [ORPHAN]: "x" },
				}),
			).rejects.toMatchObject({ code: "invalid_metadata_key" });
		});

		it("WRITE-S8 keeps a value whose field is not in the schema, as written", async () => {
			const snapshot = await prepareHeld(await draft({ [ORPHAN]: "left", [`${ORPHAN}List`]: ["a", "b"] }));
			expect(snapshot.metadata[ORPHAN]).toBe("left");
			expect(snapshot.metadata[`${ORPHAN}List`]).toEqual(["a", "b"]);
			expect(snapshot.issues).toEqual([]);
		});

		it("WRITE-S8 keeps it on an item collection as well", async () => {
			const snapshot = await prepareHeld({
				collection: recordCollection,
				slug: "a",
				metadata: { title: "T", [ORPHAN]: "left" },
				doc: docOf(""),
			} as unknown as ServiceInput);
			expect(snapshot.metadata[ORPHAN]).toBe("left");
		});

		it("WRITE-S7 still checks that a kept value is a string or a list of strings", async () => {
			await expect(prepareHeld(await draft({ [ORPHAN]: 1 }))).rejects.toMatchObject({
				code: "invalid_metadata_type",
			});
			await expect(prepareHeld(await draft({ [ORPHAN]: ["a", 1] }))).rejects.toMatchObject({
				code: "invalid_metadata_type",
			});
			await expect(prepareHeld(await draft({ [ORPHAN]: { nested: "x" } }))).rejects.toMatchObject({
				code: "invalid_metadata_type",
			});
		});

		it("WRITE-S8 does not block publishing and warns once per removed field, with the field key as the path", async () => {
			const snapshot = await prepareHeld(await draft({ [ORPHAN]: "left", other: ["x"] }));
			const validation = validateForPublish(testSite, snapshot, { targets, media: [] });
			expect(validation.ready).toBe(true);
			expect(validation.issues).toEqual([]);
			const orphans = validation.warnings.filter((warning) => warning.code === "orphaned_metadata_key");
			expect(orphans.map((warning) => warning.path).sort()).toEqual(["other", ORPHAN]);
		});

		it("WRITE-S8 does not take the per-language names of an item collection for a removed field", () => {
			expect(testSite.isOrphanedMetadataKey(recordCollection, RECORD_TRANSLATIONS_KEY)).toBe(false);
			expect(
				testSite.orphanedMetadataKeys(recordCollection, { title: "T", [RECORD_TRANSLATIONS_KEY]: {}, [ORPHAN]: "x" }),
			).toEqual([ORPHAN]);
		});

		it("WRITE-S8 is not a shared field of a translation", () => {
			expect(testSite.commonFieldKeys(contentCollection, { [ORPHAN]: "x" })).toEqual([]);
		});

		it("SITE-R5 is left out of the metadata as the current schema types it", () => {
			expect(testSite.schemaMetadata(contentCollection, { title: "T", [ORPHAN]: "x" })).toEqual({ title: "T" });
		});
	});

	describe.skipIf(!select)("a select value that is no longer an option", () => {
		const name = select?.name ?? "";

		it("WRITE-S8 is kept as written instead of failing", async () => {
			const snapshot = await prepareHeld(await draft({ [name]: UNKNOWN_OPTION }));
			expect(snapshot.metadata[name]).toBe(UNKNOWN_OPTION);
			expect(snapshot.issues).toEqual([]);
		});

		it("WRITE-S8 does not block publishing and warns with the field key as the path and the value as the message", async () => {
			const snapshot = await prepareHeld(await draft({ [name]: UNKNOWN_OPTION }));
			const validation = validateForPublish(testSite, snapshot, { targets, media: [] });
			expect(validation.ready).toBe(true);
			expect(validation.warnings).toContainEqual(
				expect.objectContaining({ code: "unknown_select_value", path: name, message: UNKNOWN_OPTION }),
			);
		});
	});
});

describe("empty body check", () => {
	/**
	 * Tests collection kind (`kind`), required fields (`required: true`) and empty-body validation (`body`) with a single test config.
	 * Builds its own site so it runs regardless of the reference blog or other site configs.
	 */
	const title = fields.text({ label: "Title", required: true });

	const slug = fields.slug({ label: "Slug", from: "title", required: true });

	const site = createSite(
		defineSite({
			collections: {
				// A document without a body (e.g. a link collection). It publishes but its body is not checked.
				page: defineCollection({ label: "Page", kind: "document", body: false, fields: { title, slug } }),
				note: defineCollection({
					label: "Note",
					kind: "document",
					fields: {
						title,
						slug,
						pageId: fields.relation({ label: "Page", to: "page", allowUnpublished: true }),
						excerpt: fields.text({ label: "Excerpt", fillFromBody: { maxLength: 40 }, max: 30 }),
					},
				}),
				label: defineCollection({ label: "Label", kind: "item", fields: { title, slug } }),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	);

	const snapshot = (collection: string, patch: object = {}) =>
		({
			collection,
			slug: "a",
			metadata: { title: "T" },
			doc: { type: "doc", version: 3, content: [] },
			contentHash: "h",
			references: [],
			issues: [],
			imageSources: [],
			...patch,
		}) as never;

	it("WRITE-P1 only collections that use a body (`body`) reject it", () => {
		expect(validateForPublish(site, snapshot("page"), { targets: [], media: [] }).issues).toEqual([]);
		expect(validateForPublish(site, snapshot("note"), { targets: [], media: [] }).issues).toContainEqual(
			expect.objectContaining({ code: "empty_body" }),
		);
	});

	it("WRITE-P1 a different target collection is `invalid_reference_collection` even for relations that allow unpublished targets", () => {
		const target = "123e4567-e89b-12d3-a456-426614174001";
		const result = validateForPublish(
			site,
			snapshot("note", { doc: docOf("본문"), metadata: { title: "T", pageId: target } }),
			{
				targets: [{ id: target, isPublished: false, collection: "note" }],
				media: [],
			},
		);
		expect(result.issues.map((issue) => issue.code)).toEqual(["invalid_reference_collection"]);
	});
});

describe("what a developer sends to the write services", () => {
	const config = defineSite({
		collections: {
			article: defineCollection({
				label: "Article",
				kind: "document",
				fields: {
					title: fields.text({ label: "Title", required: true }),
					slug: fields.slug({ label: "Slug", from: "title", required: true }),
					excerpt: fields.text({ label: "Excerpt" }),
				},
			}),
			label: defineCollection({
				label: "Label",
				kind: "item",
				fields: {
					title: fields.text({ label: "Name", required: true }),
					slug: fields.slug({ label: "Slug", from: "title", required: true }),
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});
	const site = createSite(config);

	describe("metadata the caller sends", () => {
		const input = (metadata: Record<string, unknown>) =>
			({ collection: "article", slug: "a", metadata, doc: { type: "doc", version: 3, content: [] } }) as never;

		it("WRITE-S7 treats a field set to undefined as a field that is not set", async () => {
			const snapshot = await prepareSnapshot(site, input({ title: "A", excerpt: undefined }));
			expect(snapshot.metadata).toEqual({ title: "A" });
		});

		it("WRITE-S7 names the field that has the wrong kind of value", async () => {
			const error = await prepareSnapshot(site, input({ title: "A", excerpt: 3 })).catch((caught) => caught);
			expect(error).toMatchObject({ code: "invalid_metadata_type", issues: [{ path: "excerpt" }] });
			// The message names the field, the kind it must be and the kind it got.
			expect(error.message).toContain('"excerpt"');
			expect(error.message).toContain("text");
			expect(error.message).toContain("number");
		});

		it("WRITE-S7 names the field that does not exist, and the ones that do", async () => {
			const error = await prepareSnapshot(site, input({ title: "A", subtitle: "B" })).catch((caught) => caught);
			expect(error).toMatchObject({ code: "invalid_metadata_key", issues: [{ path: "subtitle" }] });
			// The message names the field it got, the collection and the fields it has.
			expect(error.message).toContain('"subtitle"');
			expect(error.message).toMatch(/\barticle\b/);
			expect(error.message).toMatch(/\btitle\b/);
			expect(error.message).toMatch(/\bexcerpt\b/);
		});
	});

	describe("an item collection has no body", () => {
		it("WRITE-W6 is written with the metadata only, and its document is empty", async () => {
			const snapshot = await prepareSnapshot(site, {
				collection: "label",
				slug: "monti",
				metadata: { title: "Monti" },
			} as never);
			expect(snapshot.doc.content).toEqual([]);
			expect(snapshot.metadata).toEqual({ title: "Monti" });
		});

		it("WRITE-S7 is still an error for a document collection to have none", async () => {
			await expect(
				prepareSnapshot(site, { collection: "article", slug: "a", metadata: { title: "A" } } as never),
			).rejects.toMatchObject({ code: "invalid_input" });
		});
	});
});

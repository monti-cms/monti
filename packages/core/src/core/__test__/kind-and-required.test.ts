import { describe, expect, it, vi } from "vitest";

/**
 * Tests collection kind (`kind`), required fields (`required: true`) and empty-body validation (`body`) with a single test config.
 * Replaces `@cms-config` with this file's config so it runs regardless of the reference blog or other site configs.
 */
vi.mock("@cms-config", async () => {
	const { defineCollection, defineConfig, fields } = await import("../..");
	const title = fields.text({ label: "Title", required: true });
	const slug = fields.slug({ label: "Slug", from: "title", required: true });
	return {
		default: defineConfig({
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
						summary: fields.text({ label: "Summary", fillFromBody: { maxLength: 40 }, max: 30 }),
					},
				}),
				label: defineCollection({ label: "Label", kind: "item", fields: { title, slug } }),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	};
});

const { COLLECTION_DEFINITIONS, DOCUMENT_COLLECTIONS, isDocumentCollection, isItemCollection } = await import(
	"../collections"
);
const { validateForPublish } = await import("../snapshot");
const { missingRequiredIssues, schemaOf, storedField } = await import("../../schema/derive");
const { fillFromBodyLength } = await import("../../schema/fields");

/** This file's config collections (the type is widened because it is the package test config). */
const c = (name: "page" | "note" | "label") => name as never;

const snapshot = (collection: string, patch: object = {}) =>
	({
		collection,
		slug: "a",
		metadata: { title: "T" },
		mdx: "",
		schemaVersion: 1,
		contentHash: "h",
		references: [],
		issues: [],
		imageSources: [],
		...patch,
	}) as never;

describe("collection kind", () => {
	it("the core reads the normalized `kind`", () => {
		expect((COLLECTION_DEFINITIONS as Record<string, { kind: string }>).label?.kind).toBe("item");
		expect(schemaOf(c("label")).body).toBe(false);
		expect(isItemCollection("label")).toBe(true);
		expect(isDocumentCollection("page")).toBe(true);
		expect(DOCUMENT_COLLECTIONS).toEqual(["page", "note"]);
	});
});

describe("required fields (`required: true`)", () => {
	it("an empty value is an issue", () => {
		expect(missingRequiredIssues(c("label"), { slug: null, metadata: {} })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_field", path: "title", message: "Title" },
		]);
		expect(missingRequiredIssues(c("label"), { slug: "a", metadata: { title: "T" } })).toEqual([]);
	});
});

describe("empty body check", () => {
	it("only collections that use a body (`body`) reject it", () => {
		expect(validateForPublish(snapshot("page"), { targets: [], media: [] }).issues).toEqual([]);
		expect(validateForPublish(snapshot("note"), { targets: [], media: [] }).issues).toContainEqual(
			expect.objectContaining({ code: "empty_body" }),
		);
	});

	it("a different target collection is `invalid_reference_collection` even for relations that allow unpublished targets", () => {
		const target = "123e4567-e89b-12d3-a456-426614174001";
		const result = validateForPublish(snapshot("note", { mdx: "본문", metadata: { title: "T", pageId: target } }), {
			targets: [{ id: target, isPublished: false, collection: "note" }],
			media: [],
		});
		expect(result.issues.map((issue) => issue.code)).toEqual(["invalid_reference_collection"]);
	});
});

describe("filling from the body (`fillFromBody`)", () => {
	it("uses `{ maxLength }` and does not exceed the field `max`", () => {
		const field = storedField(c("note"), "summary")?.field;
		expect(field?.kind === "text" && fillFromBodyLength(field)).toBe(30);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: true })).toBe(160);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: { maxLength: 80 } })).toBe(80);
		expect(fillFromBodyLength({ kind: "text", label: "a" })).toBeUndefined();
	});
});

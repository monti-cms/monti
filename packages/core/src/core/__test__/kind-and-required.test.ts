import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/stored-content";
import { defineCollection, defineSite, fields } from "../..";
import { fillFromBodyLength } from "../../schema/fields";
import { createSite } from "../../site";
import { validateForPublish } from "../snapshot";

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
					summary: fields.text({ label: "Summary", fillFromBody: { maxLength: 40 }, max: 30 }),
				},
			}),
			label: defineCollection({ label: "Label", kind: "item", fields: { title, slug } }),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	}),
);

/** This file's config collections (the type is widened because it is the package test config). */
const c = (name: "page" | "note" | "label") => name;

const snapshot = (collection: string, patch: object = {}) =>
	({
		collection,
		slug: "a",
		metadata: { title: "T" },
		doc: { type: "doc", version: 2, content: [] },
		schemaVersion: 1,
		contentHash: "h",
		references: [],
		issues: [],
		imageSources: [],
		...patch,
	}) as never;

describe("collection kind", () => {
	it("the core reads the normalized `kind`", () => {
		expect((site.COLLECTION_DEFINITIONS as Record<string, { kind: string }>).label?.kind).toBe("item");
		expect(site.schemaOf(c("label")).body).toBe(false);
		expect(site.isItemCollection("label")).toBe(true);
		expect(site.isDocumentCollection("page")).toBe(true);
		expect(site.DOCUMENT_COLLECTIONS).toEqual(["page", "note"]);
	});
});

describe("required fields (`required: true`)", () => {
	it("an empty value is an issue", () => {
		expect(site.missingRequiredIssues(c("label"), { slug: null, metadata: {} })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_field", path: "title", message: "Title" },
		]);
		expect(site.missingRequiredIssues(c("label"), { slug: "a", metadata: { title: "T" } })).toEqual([]);
	});
});

describe("empty body check", () => {
	it("only collections that use a body (`body`) reject it", () => {
		expect(validateForPublish(site, snapshot("page"), { targets: [], media: [] }).issues).toEqual([]);
		expect(validateForPublish(site, snapshot("note"), { targets: [], media: [] }).issues).toContainEqual(
			expect.objectContaining({ code: "empty_body" }),
		);
	});

	it("a different target collection is `invalid_reference_collection` even for relations that allow unpublished targets", () => {
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

describe("filling from the body (`fillFromBody`)", () => {
	it("uses `{ maxLength }` and does not exceed the field `max`", () => {
		const field = site.storedField(c("note"), "summary")?.field;
		expect(field?.kind === "text" && fillFromBodyLength(field)).toBe(30);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: true })).toBe(160);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: { maxLength: 80 } })).toBe(80);
		expect(fillFromBodyLength({ kind: "text", label: "a" })).toBeUndefined();
	});
});

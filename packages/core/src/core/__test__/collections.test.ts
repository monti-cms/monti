import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";

/**
 * Collection helper rules that do not depend on the config. Collection and field names are looked up in the current config (`test/any-site.ts`).
 * `collections.blog.test.ts` checks the collection list of the reference blog config as is.
 */
describe("collection helpers", () => {
	it("LIST-F2 classification fields are relation fields pointing to a classification (record) collection", () => {
		for (const collection of testSite.COLLECTIONS) {
			const relations = testSite
				.storedFields(collection)
				.flatMap((stored) => (stored.field.kind === "relation" ? [{ name: stored.name, to: stored.field.to }] : []));
			// Only relations pointing to item collections remain, in declaration order; relations pointing to document collections (post lists, etc.) are excluded.
			expect(testSite.taxonomyFieldsOf(collection).map((stored) => [stored.name, stored.to])).toEqual(
				relations.filter(({ to }) => testSite.isItemCollection(to)).map(({ name, to }) => [name, to]),
			);
		}
		expect(testSite.taxonomyFieldsOf("nope")).toEqual([]);
	});
});

describe("collection kind", () => {
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

	/** This file's config collections (the type is widened because it is the package test config). */
	const c = (name: "page" | "note" | "label") => name;

	it("SCHEMA-S1 the core reads the normalized `kind`", () => {
		expect((site.COLLECTION_DEFINITIONS as Record<string, { kind: string }>).label?.kind).toBe("item");
		expect(site.schemaOf(c("label")).body).toBe(false);
		expect(site.isItemCollection("label")).toBe(true);
		expect(site.isDocumentCollection("page")).toBe(true);
		expect(site.DOCUMENT_COLLECTIONS).toEqual(["page", "note"]);
	});
});

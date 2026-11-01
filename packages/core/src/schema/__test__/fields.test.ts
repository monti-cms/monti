import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";
import {
	DEFAULT_TITLE_FIELD,
	fieldTraits,
	fillFromBodyLength,
	isStoredField,
	SUMMARY_ROLE,
	TITLE_ROLE,
} from "../fields";
import { valueFieldsOf } from "../walk";

describe("field traits", () => {
	it("SCHEMA-S3 say which kinds hold a value the way the walk lists stored fields", () => {
		for (const collection of testSite.COLLECTIONS) {
			const schema = testSite.schemaOf(collection);
			const topLevelStored = Object.entries(schema.fields)
				.filter(([, field]) => isStoredField(field))
				.map(([name]) => name);
			const listed = valueFieldsOf(schema)
				.filter((stored) => stored.when === undefined)
				.map((stored) => stored.name);
			expect(listed).toEqual(topLevelStored);
		}
	});

	it("SCHEMA-S3 keep the address, the back link and the view out of what is stored and what is per language", () => {
		for (const kind of ["slug", "backlink", "view"] as const) {
			expect(fieldTraits[kind].stored, kind).toBe(false);
			expect(fieldTraits[kind].localizable, kind).toBe(false);
		}
		expect(fieldTraits.conditional.stored).toBe(true);
		expect(fieldTraits.backlink.entersValue).toBe(false);
		expect(fieldTraits.slug.entersValue).toBe(true);
	});

	it("SCHEMA-S3 find a role field and a title the same way for the pure helpers and for the site", () => {
		for (const collection of testSite.COLLECTIONS) {
			const schema = testSite.schemaOf(collection);
			const stored = valueFieldsOf(schema);
			expect(testSite.roleField(collection, SUMMARY_ROLE)).toEqual(
				stored.find((item) => item.field.role === SUMMARY_ROLE),
			);
			const title =
				stored.find((item) => item.field.role === TITLE_ROLE) ??
				stored.find((item) => item.name === DEFAULT_TITLE_FIELD);
			expect(title, collection).toMatchObject({ field: { kind: "text" } });
			expect(testSite.titleField(collection)).toEqual(title);
			expect(testSite.localizedSet(collection)).toEqual(
				new Set(
					Object.entries(schema.fields)
						.filter(([, field]) => fieldTraits[field.kind].localizable && field.localized)
						.map(([name]) => name),
				),
			);
		}
	});
});

describe("filling from the body (`fillFromBody`)", () => {
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

	it("WRITE-W12 uses `{ maxLength }` and does not exceed the field `max`", () => {
		const field = site.storedField(c("note"), "excerpt")?.field;
		expect(field?.kind === "text" && fillFromBodyLength(field)).toBe(30);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: true })).toBe(160);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: { maxLength: 80 } })).toBe(80);
		expect(fillFromBodyLength({ kind: "text", label: "a" })).toBeUndefined();
	});
});

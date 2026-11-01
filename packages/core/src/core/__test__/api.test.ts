import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";
import { createTemplateBodySchema, LIST_ARRAY_QUERY_KEYS, patchEntryBodySchema, patchTemplateBodySchema } from "../api";

/** Every request schema that takes a body, with the other fields it needs. */
const schemas = [
	["create entry", testSite.api.createEntryBodySchema, { collection: contentCollection }],
	["patch entry", patchEntryBodySchema, { expectedVersion: 1 }],
	["create template", createTemplateBodySchema, { name: "Template" }],
	["patch template", patchTemplateBodySchema, { expectedVersion: 1 }],
] as const;

describe("the body of a write request", () => {
	it("WRITE-S7 is a document, or a text with its format, or nothing; never both, and never a text or a format alone", () => {
		const doc = docOf("Body");
		const taken = [{ doc }, { body: "Text", format: "paragraphs" }, {}];
		const refused = [
			{ doc, body: "Text", format: "paragraphs" },
			{ doc, body: "Text" },
			{ doc, format: "paragraphs" },
			{ body: "Text" },
			{ format: "paragraphs" },
		];
		for (const [name, schema, fields] of schemas) {
			for (const body of taken) {
				expect(schema.safeParse({ ...fields, ...body }).success, `${name} ${JSON.stringify(body)}`).toBe(true);
			}
			for (const body of refused) {
				const parsed = schema.safeParse({ ...fields, ...body });
				expect(parsed.error?.issues, `${name} ${JSON.stringify(body)}`).toEqual([
					expect.objectContaining({ code: "custom", path: ["doc"] }),
				]);
			}
		}
	});
});

describe("the list query of a site", () => {
	const site = createSite(
		defineSite({
			collections: {
				article: defineCollection({
					label: "Article",
					kind: "document",
					fields: {
						title: fields.text({ label: "Title", required: true }),
						slug: fields.slug({ label: "Slug", from: "title", required: true }),
					},
				}),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	);

	const { listEntriesQuerySchema: list, listCountsQuerySchema: counts } = site.api;
	const TAG = "5c1e7a8e-2d0b-4f4b-9d57-3f6a1b9a0c11";

	describe("field conditions of the list query", () => {
		it("LIST-F2 is a repeatable parameter, so a query string can carry several", () => {
			expect(LIST_ARRAY_QUERY_KEYS).toContain("field");
			expect(LIST_ARRAY_QUERY_KEYS).not.toContain("relation");
		});

		it("LIST-F2 reads empty, filled and is into conditions per field", () => {
			const parsed = list.parse({
				collection: "article",
				field: ["labels:empty", `labels:is:${TAG}`, "excerpt:filled", "layout:is:wide"],
			});
			expect(parsed.field).toEqual({
				labels: [{ kind: "empty" }, { kind: "is", value: TAG }],
				excerpt: [{ kind: "filled" }],
				layout: [{ kind: "is", value: "wide" }],
			});
		});

		it("LIST-F2 keeps a value that has colons in it whole, and a value named like a condition a value", () => {
			const parsed = list.parse({ collection: "article", field: ["layout:is:a:b", "layout:is:empty"] });
			expect(parsed.field?.layout).toEqual([
				{ kind: "is", value: "a:b" },
				{ kind: "is", value: "empty" },
			]);
		});

		it("LIST-F2 refuses what is not a condition", () => {
			for (const field of [
				"labels",
				"labels:",
				"labels:maybe",
				"labels:is",
				"labels:is:",
				"labels:empty:x",
				"1bad:empty",
				":empty",
			]) {
				expect(list.safeParse({ collection: "article", field: [field] }).success).toBe(false);
			}
		});

		it("LIST-F2 no longer reads relation filters", () => {
			const parsed = list.parse({ collection: "article", relation: [`labels:${TAG}`] });
			expect("relation" in parsed).toBe(false);
		});
	});

	describe("translation filter of the list query", () => {
		it("LIST-F2 takes none, changed and current, repeated for OR", () => {
			expect(list.parse({ collection: "article", translation: ["none", "changed"] }).translation).toEqual([
				"none",
				"changed",
			]);
			expect(LIST_ARRAY_QUERY_KEYS).toContain("translation");
		});

		it("LIST-F2 refuses another word", () => {
			expect(list.safeParse({ collection: "article", translation: ["stale"] }).success).toBe(false);
		});
	});

	describe("status filter of the list query", () => {
		it("LIST-F2 takes the four states and the trash, repeated for OR", () => {
			expect(list.parse({ collection: "article", status: ["published", "editing"] }).status).toEqual([
				"published",
				"editing",
			]);
			expect(LIST_ARRAY_QUERY_KEYS).toContain("status");
			expect(list.safeParse({ collection: "article", status: ["draft", "archived", "trashed"] }).success).toBe(true);
		});

		it("LIST-F2 refuses another word, and has no separate unpublished-changes flag", () => {
			expect(list.safeParse({ collection: "article", status: ["live"] }).success).toBe(false);
			expect("hasChanges" in list.parse({ collection: "article", hasChanges: "true" })).toBe(false);
		});
	});

	describe("column filters are gone from the list query", () => {
		it("LIST-F1 does not carry titleContains or slugContains", () => {
			const parsed = list.parse({ collection: "article", titleContains: "a", slugContains: "b" });
			expect("titleContains" in parsed).toBe(false);
			expect("slugContains" in parsed).toBe(false);
		});
	});

	describe("counts query", () => {
		it("LIST-F3 asks for one field or for one facet, not both and not neither", () => {
			expect(counts.safeParse({ collection: "article", field: "labels" }).success).toBe(true);
			expect(counts.safeParse({ collection: "article", facet: "translation" }).success).toBe(true);
			expect(counts.safeParse({ collection: "article", facet: "status" }).success).toBe(true);
			expect(counts.safeParse({ collection: "article", facet: "nothing" }).success).toBe(false);
			expect(counts.safeParse({ collection: "article" }).success).toBe(false);
			expect(counts.safeParse({ collection: "article", field: "labels", facet: "translation" }).success).toBe(false);
		});

		it("LIST-F3 takes the folder that scopes the rows, and no status", () => {
			const parsed = counts.parse({
				collection: "article",
				facet: "status",
				folderId: "null",
				includeDescendants: "true",
				status: ["draft"],
			});
			expect(parsed).toMatchObject({ folderId: null, includeDescendants: true });
			expect("status" in parsed).toBe(false);
		});
	});
});

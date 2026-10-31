import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";
import { LIST_ARRAY_QUERY_KEYS } from "../api";

const site = createSite(
	defineSite({
		collections: {
			post: defineCollection({
				label: "Post",
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
			collection: "post",
			field: ["tags:empty", `tags:is:${TAG}`, "summary:filled", "layout:is:wide"],
		});
		expect(parsed.field).toEqual({
			tags: [{ kind: "empty" }, { kind: "is", value: TAG }],
			summary: [{ kind: "filled" }],
			layout: [{ kind: "is", value: "wide" }],
		});
	});

	it("LIST-F2 keeps a value that has colons in it whole, and a value named like a condition a value", () => {
		const parsed = list.parse({ collection: "post", field: ["layout:is:a:b", "layout:is:empty"] });
		expect(parsed.field?.layout).toEqual([
			{ kind: "is", value: "a:b" },
			{ kind: "is", value: "empty" },
		]);
	});

	it("LIST-F2 refuses what is not a condition", () => {
		for (const field of [
			"tags",
			"tags:",
			"tags:maybe",
			"tags:is",
			"tags:is:",
			"tags:empty:x",
			"1bad:empty",
			":empty",
		]) {
			expect(list.safeParse({ collection: "post", field: [field] }).success).toBe(false);
		}
	});

	it("LIST-F2 no longer reads relation filters", () => {
		const parsed = list.parse({ collection: "post", relation: [`tags:${TAG}`] });
		expect("relation" in parsed).toBe(false);
	});
});

describe("translation filter of the list query", () => {
	it("LIST-F2 takes none, changed and current, repeated for OR", () => {
		expect(list.parse({ collection: "post", translation: ["none", "changed"] }).translation).toEqual([
			"none",
			"changed",
		]);
		expect(LIST_ARRAY_QUERY_KEYS).toContain("translation");
	});

	it("LIST-F2 refuses another word", () => {
		expect(list.safeParse({ collection: "post", translation: ["stale"] }).success).toBe(false);
	});
});

describe("status filter of the list query", () => {
	it("LIST-F2 takes the four states and the trash, repeated for OR", () => {
		expect(list.parse({ collection: "post", status: ["published", "editing"] }).status).toEqual([
			"published",
			"editing",
		]);
		expect(LIST_ARRAY_QUERY_KEYS).toContain("status");
		expect(list.safeParse({ collection: "post", status: ["draft", "archived", "trashed"] }).success).toBe(true);
	});

	it("LIST-F2 refuses another word, and has no separate unpublished-changes flag", () => {
		expect(list.safeParse({ collection: "post", status: ["live"] }).success).toBe(false);
		expect("hasChanges" in list.parse({ collection: "post", hasChanges: "true" })).toBe(false);
	});
});

describe("column filters are gone from the list query", () => {
	it("LIST-F1 does not carry titleContains or slugContains", () => {
		const parsed = list.parse({ collection: "post", titleContains: "a", slugContains: "b" });
		expect("titleContains" in parsed).toBe(false);
		expect("slugContains" in parsed).toBe(false);
	});
});

describe("counts query", () => {
	it("LIST-F3 asks for one field or for one facet, not both and not neither", () => {
		expect(counts.safeParse({ collection: "post", field: "tags" }).success).toBe(true);
		expect(counts.safeParse({ collection: "post", facet: "translation" }).success).toBe(true);
		expect(counts.safeParse({ collection: "post", facet: "status" }).success).toBe(true);
		expect(counts.safeParse({ collection: "post", facet: "nothing" }).success).toBe(false);
		expect(counts.safeParse({ collection: "post" }).success).toBe(false);
		expect(counts.safeParse({ collection: "post", field: "tags", facet: "translation" }).success).toBe(false);
	});

	it("LIST-F3 takes the folder that scopes the rows, and no status", () => {
		const parsed = counts.parse({
			collection: "post",
			facet: "status",
			folderId: "null",
			includeDescendants: "true",
			status: ["draft"],
		});
		expect(parsed).toMatchObject({ folderId: null, includeDescendants: true });
		expect("status" in parsed).toBe(false);
	});
});

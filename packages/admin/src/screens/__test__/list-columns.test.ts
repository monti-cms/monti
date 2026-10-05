import { describe, expect, it, vi } from "vitest";

// A site whose slug field is not named `slug`.
vi.mock("@monti-cms/core/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@monti-cms/core/client")>();
	const article = {
		label: "Article",
		kind: "document",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			permalink: { kind: "slug", label: "Permalink", from: "title" },
		},
		list: { columns: ["title", "permalink", "status"] },
	};
	const note = { ...article, fields: { title: { kind: "text", label: "Title" } }, list: { columns: ["title"] } };
	// A collection with no list setting (`list`): uses the default columns.
	const story = {
		label: "Story",
		kind: "document",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			topicId: { kind: "relation", label: "Topic", to: "topic" },
		},
	};
	const topic = {
		label: "Topic",
		kind: "item",
		body: false,
		fields: { title: { kind: "text", label: "Title" }, key: { kind: "slug", label: "Key", from: "title" } },
	};
	const own: Record<string, unknown> = { article, note, story, topic };
	const taxonomy: Record<string, unknown[]> = {
		story: [{ name: "topicId", field: story.fields.topicId, to: "topic" }],
	};
	return {
		...actual,
		// A site with two or more locales.
		LOCALES: ["en", "ko"],
		isCollection: (name: string) => name in own || actual.isCollection(name),
		schemaOf: (name: string) => own[name] ?? actual.schemaOf(name as never),
		taxonomyFieldsOf: (name: string) => taxonomy[name] ?? (name in own ? [] : actual.taxonomyFieldsOf(name as never)),
	};
});

const { columnsFor, defaultListColumns } = await import("../list-columns");

describe("list columns", () => {
	it("finds the slug column by field kind, not by name", () => {
		const { available, defaults } = columnsFor("article");
		expect(available).toContain("slug");
		expect(defaults).toEqual(["title", "slug", "status"]);
	});

	it("has no slug column without a slug field, and always has a title column", () => {
		const { available } = columnsFor("note");
		expect(available).not.toContain("slug");
		expect(available).toContain("title");
	});

	it("without a list setting the default columns are used: documents get title, status, locale, taxonomy fields, updated and published dates; items get title, slug, locale, status, updated date", () => {
		for (const collection of ["story", "topic"]) {
			const defaults = defaultListColumns(collection);
			expect(defaults[0]).toBe("title");
			expect(defaults).toContain("status");
			expect(defaults).toContain("locale");
			expect(defaults).toContain("updatedAt");
			expect(columnsFor(collection).defaults).toEqual(defaults);
		}
		expect(defaultListColumns("story")).toContain("topicId");
		expect(defaultListColumns("story")).toContain("publishedAt");
		expect(defaultListColumns("topic")).toContain("slug");
	});
});

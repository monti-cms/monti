import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { columnsFor, defaultListColumns } from "../list-columns";

// A site whose slug field is not named `slug`, with two locales.
const article = defineCollection({
	label: "Article",
	kind: "document",
	path: "/:slug",
	fields: {
		title: fields.text({ label: "Title" }),
		permalink: fields.slug({ label: "Permalink", from: "title" }),
	},
	list: { columns: ["title", "permalink", "status"] },
});
const note = defineCollection({
	label: "Note",
	kind: "document",
	fields: { title: fields.text({ label: "Title" }) },
	list: { columns: ["title"] },
});
// A collection with no list setting (`list`): uses the default columns.
const story = defineCollection({
	label: "Story",
	kind: "document",
	fields: {
		title: fields.text({ label: "Title" }),
		topicId: fields.relation({ label: "Topic", to: "topic" }),
	},
});
const topic = defineCollection({
	label: "Topic",
	kind: "item",
	fields: { title: fields.text({ label: "Title" }), key: fields.slug({ label: "Key", from: "title" }) },
});
const site = createSite(
	defineConfig({
		collections: { article, note, story, topic },
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		],
		defaultLocale: "en",
	}),
);

describe("list columns", () => {
	it("finds the slug column by field kind, not by name", () => {
		const { available, defaults } = columnsFor(site, "article");
		expect(available).toContain("slug");
		expect(defaults).toEqual(["title", "slug", "status"]);
	});

	it("has no slug column without a slug field, and always has a title column", () => {
		const { available } = columnsFor(site, "note");
		expect(available).not.toContain("slug");
		expect(available).toContain("title");
	});

	it("without a list setting the default columns are used: documents get title, status, locale, taxonomy fields, updated and published dates; items get title, slug, locale, status, updated date", () => {
		for (const collection of ["story", "topic"]) {
			const defaults = defaultListColumns(site, collection);
			expect(defaults[0]).toBe("title");
			expect(defaults).toContain("status");
			expect(defaults).toContain("locale");
			expect(defaults).toContain("updatedAt");
			expect(columnsFor(site, collection).defaults).toEqual(defaults);
		}
		expect(defaultListColumns(site, "story")).toContain("topicId");
		expect(defaultListColumns(site, "story")).toContain("publishedAt");
		expect(defaultListColumns(site, "topic")).toContain("slug");
	});
});

describe("locale column and the translation UI option", () => {
	const make = (locales: { code: string; name: string }[], admin?: { translations?: boolean }) =>
		createSite(
			defineConfig({
				collections: { article, note, story, topic },
				locales,
				defaultLocale: "en",
				...(admin ? { admin } : {}),
			}),
		);
	const one = [{ code: "en", name: "English" }];
	const two = [...one, { code: "ko", name: "Korean" }];

	it("has a locale column on a site with several locales", () => {
		expect(columnsFor(make(two), "story").available).toContain("locale");
	});

	it("has no locale column on a single-locale site, and the other columns stay in order", () => {
		const { available, defaults } = columnsFor(make(one), "story");
		expect(available).not.toContain("locale");
		expect(defaults).not.toContain("locale");
		expect(defaults.slice(0, 2)).toEqual(["title", "status"]);
		expect(available.indexOf("topicId")).toBe(available.indexOf("status") + 1);
	});

	it("has no locale column on a multi-locale site that turns the translation UI off", () => {
		const site = make(two, { translations: false });
		expect(columnsFor(site, "story").available).not.toContain("locale");
		expect(columnsFor(site, "topic").defaults).not.toContain("locale");
	});
});

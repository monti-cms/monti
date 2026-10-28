import { defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
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
});
const note = defineCollection({
	label: "Note",
	kind: "document",
	fields: { title: fields.text({ label: "Title" }), subtitle: fields.text({ label: "Subtitle" }) },
});
// A collection that uses the default columns.
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
	fields: {
		title: fields.text({ label: "Title", localized: true }),
		key: fields.slug({ label: "Key", from: "title" }),
	},
});
// An item collection with no per-locale field: its values are the same in every locale.
const label = defineCollection({
	label: "Label",
	kind: "item",
	fields: { title: fields.text({ label: "Title" }) },
});
const site = createSite(
	defineSite({
		collections: { article, note, story, topic, label },
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
		expect(defaults).not.toContain("slug");
	});

	it("offers every other stored field as a column, hidden until the writer shows it", () => {
		const { available, defaults } = columnsFor(site, "note");
		expect(available).toContain("subtitle");
		expect(defaults).not.toContain("subtitle");
		expect(available.filter((column) => column === "title")).toHaveLength(1);
	});

	it("has no slug column without a slug field, and always has a title column", () => {
		const { available } = columnsFor(site, "note");
		expect(available).not.toContain("slug");
		expect(available).toContain("title");
	});

	it("until the writer chooses columns the default ones are used: documents get status, title, taxonomy fields, locale and the updated date; items get status, title, locale, updated date and keep the slug beside the title", () => {
		for (const collection of ["story", "topic"]) {
			const defaults = defaultListColumns(site, collection);
			expect(defaults.slice(0, 2)).toEqual(["status", "title"]);
			expect(defaults).toContain("status");
			expect(defaults).toContain("locale");
			expect(defaults).toContain("updatedAt");
			expect(columnsFor(site, collection).defaults).toEqual(defaults);
		}
		expect(defaultListColumns(site, "story")).toContain("topicId");
		// One date by default, as the board draws it; the published date is there to turn on in the View menu.
		expect(defaultListColumns(site, "story")).not.toContain("publishedAt");
		expect(columnsFor(site, "story").available).toContain("publishedAt");
		// The slug column exists but is off until the writer turns it on.
		expect(defaultListColumns(site, "topic")).not.toContain("slug");
		expect(columnsFor(site, "topic").available).toContain("slug");
	});
});

describe("locale column and the translation UI option", () => {
	const make = (locales: { code: string; name: string }[], admin?: { translations?: boolean }) =>
		createSite(
			defineSite({
				collections: { article, note, story, topic, label },
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
		expect(defaults.slice(0, 3)).toEqual(["status", "title", "topicId"]);
		expect(available.indexOf("topicId")).toBe(available.indexOf("status") + 1);
	});

	it("has no locale column on a multi-locale site that turns the translation UI off", () => {
		const site = make(two, { translations: false });
		expect(columnsFor(site, "story").available).not.toContain("locale");
		expect(columnsFor(site, "topic").defaults).not.toContain("locale");
	});

	it("has no locale column on an item collection without a per-locale field", () => {
		const site = make(two);
		expect(columnsFor(site, "label").available).not.toContain("locale");
		expect(columnsFor(site, "label").defaults).not.toContain("locale");
		expect(columnsFor(site, "topic").defaults).toContain("locale");
	});
});

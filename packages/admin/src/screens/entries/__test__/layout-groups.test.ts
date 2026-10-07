import { defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { defaultTab, layoutGroupsOf, tabOf, tabsOf } from "../layout-groups";

// A site mixing field `tab` and layout group `tab`. Checks that field groups supplied by an extension (with `tab`) gather in their own tab without a layout.
const page = defineCollection({
	label: "Page",
	kind: "document",
	fields: {
		title: fields.text({ label: "Title" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		intro: fields.text({ label: "Intro" }),
		hero: fields.media({ label: "Hero", tab: "Media" }),
		// A layout group's `tab` takes priority over the field `tab`.
		alt: fields.text({ label: "Alt", tab: "Media" }),
		metaTitle: fields.text({ label: "Meta title", tab: "Search" }),
		preview: fields.view({ view: "search", tab: "Search" }),
		note: fields.text({ label: "Note" }),
	},
	layout: [{ fields: ["title", "slug", "intro", "hero"] }, { group: "Accessibility", tab: "Extra", fields: ["alt"] }],
	list: { columns: ["title"] },
});
// A collection with no layout (`layout`). One group in field declaration order, and fields with their own `tab` gather in that tab.
const plainCollection = defineCollection({
	label: "Plain",
	kind: "item",
	fields: {
		title: fields.text({ label: "Title" }),
		metaTitle: fields.text({ label: "Meta title", tab: "Search" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		note: fields.text({ label: "Note" }),
	},
});
const site = createSite(
	defineSite({
		collections: { page, plain: plainCollection },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	}),
);
const DEFAULT_TAB = defaultTab(site);

describe("properties panel groups and tabs (layout `tab` or field `tab`)", () => {
	it("fields with a field `tab` gather into that tab's group whether or not they are in the layout. The layout group's `tab` takes priority", () => {
		expect(layoutGroupsOf(site, "page")).toEqual([
			{ fields: ["title", "slug", "intro"] },
			{ group: "Accessibility", tab: "Extra", fields: ["alt"] },
			{ fields: ["note"] },
			{ group: "Media", tab: "Media", fields: ["hero"] },
			{ group: "Search", tab: "Search", fields: ["metaTitle", "preview"] },
		]);
	});

	it("without a layout, there is one group in field declaration order, and fields with a field `tab` gather in that tab", () => {
		const plain = "plain";
		expect(layoutGroupsOf(site, plain)).toEqual([
			{ fields: ["title", "slug", "note"] },
			{ group: "Search", tab: "Search", fields: ["metaTitle"] },
		]);
		expect(tabsOf(site, plain)).toEqual([DEFAULT_TAB, "Search"]);
	});

	it("tabs are the default tab first, then the rest in order of first appearance. Finds the tab that holds a field", () => {
		expect(tabsOf(site, "page")).toEqual([DEFAULT_TAB, "Extra", "Media", "Search"]);
		expect(tabOf(site, "page", "hero")).toBe("Media");
		expect(tabOf(site, "page", "alt")).toBe("Extra");
		expect(tabOf(site, "page", "metaTitle")).toBe("Search");
		expect(tabOf(site, "page", "note")).toBe(DEFAULT_TAB);
		expect(tabOf(site, "page", "title")).toBe(DEFAULT_TAB);
	});
});

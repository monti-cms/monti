import { describe, expect, it } from "vitest";
import { type ConfigError, defineCollection, definePlugin, defineSite, fields } from "../..";
import { createSite } from "../../site";
import { DEFAULT_TAB, isPanelField, type NamedPlacement, panelGroupsOf, panelTabsOf, placementsOf } from "../layout";

const searchPlugin = definePlugin({
	name: "finder",
	options: {},
	contributes: { layout: [{ tab: "Search", roles: ["seoTitle"], views: ["search"] }] },
});

const page = defineCollection({
	label: "Page",
	kind: "document",
	fields: {
		title: fields.text({ label: "Title" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		intro: fields.text({ label: "Intro" }),
		hero: fields.media({ label: "Hero" }),
		alt: fields.text({ label: "Alt" }),
		metaTitle: fields.text({ label: "Meta title", role: "seoTitle" }),
		preview: fields.view({ view: "search" }),
		note: fields.text({ label: "Note" }),
	},
	layout: [
		{ fields: ["title", "slug", "intro", "hero"] },
		{ group: "Accessibility", tab: "Extra", fields: ["alt"], collapsed: true },
	],
});
const plain = defineCollection({
	label: "Plain",
	kind: "item",
	fields: {
		title: fields.text({ label: "Title" }),
		metaTitle: fields.text({ label: "Meta title", role: "seoTitle" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		note: fields.text({ label: "Note" }),
	},
});
const config = defineSite({
	collections: { page, plain },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	plugins: [searchPlugin],
});
const site = createSite(config);

describe("the groups of the properties panel", () => {
	it("follow the layout, then the fields it does not list, then what plugins place in their own tab", () => {
		expect(site.panelGroupsOf("page")).toEqual([
			{ fields: ["slug", "intro", "hero"], tab: DEFAULT_TAB },
			{ group: "Accessibility", collapsed: true, tab: "Extra", fields: ["alt"] },
			{ fields: ["note"], tab: DEFAULT_TAB },
			{ group: "Search", tab: "Search", fields: ["metaTitle", "preview"], placedBy: "finder" },
		]);
	});

	it("leave the title of a document out, and keep the title of an item (the record panel draws it)", () => {
		expect(isPanelField(page, "title")).toBe(false);
		expect(isPanelField(plain, "title")).toBe(true);
		expect(site.panelGroupsOf("plain")[0]?.fields).toEqual(["title", "slug", "note"]);
	});

	it("without a layout are one run in declaration order, and the plugin's fields still get their tab", () => {
		expect(site.panelGroupsOf("plain")).toEqual([
			{ fields: ["title", "slug", "note"], tab: DEFAULT_TAB },
			{ group: "Search", tab: "Search", fields: ["metaTitle"], placedBy: "finder" },
		]);
		expect(site.panelTabsOf("plain")).toEqual([DEFAULT_TAB, "Search"]);
	});

	it("list the tabs, default first, then in order of first appearance, and find the tab of a field", () => {
		expect(site.panelTabsOf("page")).toEqual([DEFAULT_TAB, "Extra", "Search"]);
		expect(site.panelTabOf("page", "alt")).toBe("Extra");
		expect(site.panelTabOf("page", "metaTitle")).toBe("Search");
		expect(site.panelTabOf("page", "note")).toBe(DEFAULT_TAB);
		expect(site.panelTabOf("page", "title")).toBe(DEFAULT_TAB);
	});

	it("let a plugin's placement win over the layout, and never draw a field twice", () => {
		const schema = { ...page, layout: [{ tab: "Mine", fields: ["metaTitle", "intro", "intro"] }] };
		const groups = panelGroupsOf(schema, placementsOf([searchPlugin]));
		expect(groups.flatMap((group) => group.fields).sort()).toEqual(
			["alt", "hero", "intro", "metaTitle", "note", "preview", "slug"].sort(),
		);
		expect(groups.find((group) => group.fields.includes("metaTitle"))?.placedBy).toBe("finder");
		expect(groups.find((group) => group.tab === "Mine")?.fields).toEqual(["intro"]);
	});

	it("keep a tab a person added before it has a field", () => {
		const schema = { ...plain, layout: [{ fields: [], tab: "Later" }] };
		expect(panelTabsOf(panelGroupsOf(schema))).toEqual([DEFAULT_TAB, "Later"]);
	});

	it("tell the default tab by its id, so a tab named like its translation is a different tab", () => {
		const schema = { ...plain, layout: [{ group: "Mine", tab: "Properties", fields: ["note"] }] };
		const groups = panelGroupsOf(schema);
		expect(panelTabsOf(groups)).toEqual([DEFAULT_TAB, "Properties"]);
		expect(DEFAULT_TAB).toBe("");
	});

	it("read nothing from a plugin that places nothing", () => {
		const none: NamedPlacement[] = placementsOf([definePlugin({ name: "quiet", options: {} })]);
		expect(none).toEqual([]);
	});
});

describe("what plugins place is checked with the config", () => {
	it("reports a tab name the panel cannot show, and role and view lists that are not names", () => {
		const bad = definePlugin({
			name: "bad",
			options: {},
			// Malformed on purpose: a config written without types can hold anything.
			contributes: { layout: [{ tab: "", roles: "seoTitle" }, { views: ["x"] }] as never },
		});
		try {
			defineSite({
				collections: { plain },
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
				plugins: [bad],
			});
			expect.unreachable();
		} catch (error) {
			expect((error as ConfigError).issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
				"plugins.bad.contributes.layout[0].tab:tab-name",
				"plugins.bad.contributes.layout[0].roles:type",
				"plugins.bad.contributes.layout[1].tab:required",
			]);
		}
	});
});

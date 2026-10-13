import { describe, expect, it } from "vitest";
import {
	addGroup,
	addTab,
	dropFieldOnField,
	editGroup,
	hasTabLevel,
	moveFieldBy,
	moveFieldToTab,
	moveGroup,
	moveGroupBy,
	moveGroupToTab,
	moveTab,
	placeField,
	removeGroup,
	removeTab,
	renameTab,
	type Tree,
	treeOf,
	withTree,
} from "../layout-model";
import { fieldsOf, type Obj } from "../schema-model";

const DEFAULT = "Properties";
const text = (label: string, extra: Obj = {}): Obj => ({ kind: "text", label, ...extra });
const post = (layout?: unknown, extra: Record<string, Obj> = {}): Obj => ({
	label: "Post",
	kind: "document",
	fields: {
		title: text("Title"),
		slug: text("Slug"),
		summary: text("Summary"),
		cover: text("Cover"),
		internal: text("Internal", { hidden: true }),
		seoTitle: text("SEO title", { tab: "SEO" }),
		...extra,
	},
	...(layout ? { layout } : {}),
});
const read = (collection: Obj) => treeOf(collection, DEFAULT);
/** Tree to schema and back: it must be the same tree. */
const roundTrip = (collection: Obj, tree: Tree) => read(withTree(collection, tree));
const shape = (tree: Tree) =>
	tree.tabs.map((tab) => ({
		tab: tab.name,
		groups: tab.groups.map((group) => [group.title, group.fields]),
		ungrouped: tab.ungrouped,
		locked: tab.locked,
	}));

describe("layout tree", () => {
	it("pins the title and hidden fields, locks fields a plugin placed, and leaves the rest in no group", () => {
		const tree = read(post());
		expect(tree.pinned).toEqual(["title", "internal"]);
		expect(shape(tree)).toEqual([
			{ tab: DEFAULT, groups: [], ungrouped: ["slug", "summary", "cover"], locked: [] },
			{ tab: "SEO", groups: [], ungrouped: [], locked: ["seoTitle"] },
		]);
		expect(hasTabLevel(tree)).toBe(true);
		expect(hasTabLevel(read({ ...post(), fields: { title: text("Title"), slug: text("Slug") } }))).toBe(false);
	});

	it("reads groups into their tabs, and a group without a title as fields in no group", () => {
		const tree = read(
			post([
				{ group: "Media", fields: ["cover"], collapsed: true },
				{ fields: ["summary"], tab: "More" },
				{ group: "Extra", fields: ["slug", "nope"], tab: "More" },
			]),
		);
		expect(shape(tree)).toEqual([
			{ tab: DEFAULT, groups: [["Media", ["cover"]]], ungrouped: [], locked: [] },
			{ tab: "More", groups: [["Extra", ["slug"]]], ungrouped: ["summary"], locked: [] },
			{ tab: "SEO", groups: [], ungrouped: [], locked: ["seoTitle"] },
		]);
		expect(tree.tabs[0]?.groups[0]?.collapsed).toBe(true);
	});

	it("never puts the title, a hidden field or a locked field in a group", () => {
		const tree = read(post([{ group: "A", fields: ["title", "internal", "seoTitle", "summary"] }]));
		expect(tree.tabs[0]?.groups[0]?.fields).toEqual(["summary"]);
		expect(tree.pinned).toEqual(["title", "internal"]);
		expect(tree.tabs[1]?.locked).toEqual(["seoTitle"]);
	});

	it("saves the order of the fields and the layout together, and reads the same tree back", () => {
		const collection = post();
		let tree = read(collection);
		tree = addGroup(tree, 0, "Media");
		tree = placeField(tree, "cover", 0, 0);
		tree = addTab(tree, "More");
		tree = addGroup(tree, 2, "Details");
		tree = placeField(tree, "summary", 2, 0);
		tree = moveFieldToTab(tree, "slug", 2);
		const saved = withTree(collection, tree);
		expect(Object.keys(fieldsOf(saved))).toEqual(["title", "internal", "cover", "seoTitle", "summary", "slug"]);
		expect(saved.layout).toEqual([
			{ group: "Media", fields: ["cover"] },
			{ fields: [], tab: "SEO" },
			{ group: "Details", fields: ["summary"], tab: "More" },
			{ fields: ["slug"], tab: "More" },
		]);
		expect(shape(roundTrip(collection, tree))).toEqual(shape(tree));
	});

	it("writes no group when the last group is deleted, keeping the plugin's own tab", () => {
		const collection = post([{ group: "Media", fields: ["cover"] }]);
		const saved = withTree(collection, removeGroup(read(collection), { tab: 0, index: 0 }));
		// The SEO tab is the plugin's, so its (empty) group stays out too: only the file's own tabs are written.
		expect(saved.layout).toEqual([{ fields: [], tab: "SEO" }]);
		expect(Object.keys(fieldsOf(saved))).toEqual(["title", "internal", "cover", "slug", "summary", "seoTitle"]);
	});

	it("moves a field into another group and out to no group, and reorders within a group", () => {
		const collection = post([
			{ group: "A", fields: ["summary", "cover"] },
			{ group: "B", fields: ["slug"] },
		]);
		let tree = dropFieldOnField(read(collection), "summary", "slug");
		expect(shape(tree)[0]?.groups).toEqual([
			["A", ["cover"]],
			["B", ["summary", "slug"]],
		]);
		tree = dropFieldOnField(tree, "cover", "summary");
		expect(shape(tree)[0]?.groups[1]).toEqual(["B", ["cover", "summary", "slug"]]);
		// Dropping down within a group lands after, dropping up lands before.
		expect(shape(dropFieldOnField(tree, "cover", "slug"))[0]?.groups[1]).toEqual(["B", ["summary", "slug", "cover"]]);
		tree = placeField(tree, "summary", 0, null);
		expect(shape(tree)[0]?.ungrouped).toEqual(["summary"]);
	});

	it("moves a field one step, into the next group at the edge of a group, and across tabs", () => {
		const collection = post([
			{ group: "A", fields: ["summary"] },
			{ group: "B", fields: ["cover"], tab: "More" },
		]);
		const tree = read(collection);
		expect(shape(moveFieldBy(tree, "summary", 1))[0]).toMatchObject({
			groups: [["A", []]],
			ungrouped: ["summary", "slug"],
		});
		// The last field of the default tab goes into the first group of the next tab.
		expect(shape(moveFieldBy(moveFieldToTab(tree, "slug", 0), "slug", 1))[1]?.groups[0]).toEqual([
			"B",
			["slug", "cover"],
		]);
		// Nothing above the first group.
		expect(shape(moveFieldBy(tree, "summary", -1))).toEqual(shape(tree));
	});

	it("adds, renames, collapses and deletes a group; deleting sends its fields to the tab's fields in no group", () => {
		let tree = addGroup(read(post()), 0, "New");
		tree = editGroup(tree, { tab: 0, index: 0 }, { title: "Renamed", collapsed: true });
		expect(tree.tabs[0]?.groups[0]).toEqual({ title: "Renamed", collapsed: true, fields: [] });
		// A blank title is not a rename.
		expect(editGroup(tree, { tab: 0, index: 0 }, { title: "  " }).tabs[0]?.groups[0]?.title).toBe("Renamed");
		tree = placeField(tree, "cover", 0, 0);
		expect(withTree(post(), tree).layout).toEqual([
			{ group: "Renamed", fields: ["cover"], collapsed: true },
			{ fields: [], tab: "SEO" },
		]);
		tree = editGroup(tree, { tab: 0, index: 0 }, { collapsed: false });
		expect(tree.tabs[0]?.groups[0]?.collapsed).toBeUndefined();
		expect(shape(removeGroup(tree, { tab: 0, index: 0 }))[0]).toMatchObject({
			groups: [],
			ungrouped: ["cover", "slug", "summary"],
		});
	});

	it("reorders groups with their fields, within a tab and between tabs", () => {
		const collection = post([
			{ group: "A", fields: ["summary"] },
			{ group: "B", fields: ["cover"] },
			{ group: "C", fields: ["slug"], tab: "More" },
		]);
		const tree = read(collection);
		expect(shape(moveGroup(tree, { tab: 0, index: 0 }, { tab: 0, index: 1 }))[0]?.groups).toEqual([
			["B", ["cover"]],
			["A", ["summary"]],
		]);
		expect(shape(moveGroupBy(tree, { tab: 0, index: 1 }, -1))[0]?.groups[0]?.[0]).toBe("B");
		expect(shape(moveGroupBy(tree, { tab: 0, index: 1 }, 1))[0]?.groups[1]?.[0]).toBe("B");
		const moved = moveGroupToTab(tree, { tab: 0, index: 0 }, 1);
		expect(shape(moved)[0]?.groups).toEqual([["B", ["cover"]]]);
		expect(shape(moved)[1]?.groups).toEqual([
			["C", ["slug"]],
			["A", ["summary"]],
		]);
		expect(shape(roundTrip(collection, moved))).toEqual(shape(moved));
	});

	it("adds, renames, reorders and removes tabs; the default tab and a tab a plugin fills stay", () => {
		let tree = read({ ...post(), fields: { title: text("Title"), slug: text("Slug"), cover: text("Cover") } });
		tree = addTab(tree, "More");
		tree = addTab(tree, "Other");
		// A name that is taken or empty is not a tab.
		expect(addTab(tree, "More").tabs).toHaveLength(3);
		expect(addTab(tree, "  ").tabs).toHaveLength(3);
		tree = moveTab(tree, 2, -1);
		expect(tree.tabs.map((tab) => tab.name)).toEqual([DEFAULT, "Other", "More"]);
		// The default tab stays first.
		expect(moveTab(tree, 1, -1).tabs[0]?.name).toBe(DEFAULT);
		tree = renameTab(tree, 1, "Renamed");
		expect(tree.tabs[1]?.name).toBe("Renamed");
		expect(renameTab(tree, 0, "X").tabs[0]?.name).toBe(DEFAULT);
		tree = addGroup(tree, 1, "G");
		tree = placeField(moveFieldToTab(tree, "cover", 1), "cover", 1, 0);
		tree = removeTab(tree, 1);
		expect(shape(tree)[0]).toMatchObject({ groups: [["G", ["cover"]]], ungrouped: ["slug"] });
		expect(tree.tabs.map((tab) => tab.name)).toEqual([DEFAULT, "More"]);

		const seo = read(post());
		expect(removeTab(seo, 1).tabs).toHaveLength(2);
		expect(renameTab(seo, 1, "Other").tabs[1]?.name).toBe("SEO");
	});

	it("keeps an empty tab alive through the file", () => {
		const collection = post(undefined, {});
		const tree = addTab(read({ ...collection, fields: { title: text("Title"), slug: text("Slug") } }), "Later");
		const saved = withTree({ ...collection, fields: { title: text("Title"), slug: text("Slug") } }, tree);
		expect(saved.layout).toEqual([{ fields: [], tab: "Later" }]);
		expect(read(saved).tabs.map((tab) => tab.name)).toEqual([DEFAULT, "Later"]);
	});

	it("round-trips a tree with every kind of row", () => {
		const collection = post([
			{ group: "A", fields: ["summary"], collapsed: true },
			{ fields: ["cover"], tab: "More" },
			{ group: "B", fields: ["slug"], tab: "More" },
		]);
		const tree = read(collection);
		expect(shape(roundTrip(collection, tree))).toEqual(shape(tree));
		// Saving twice changes nothing.
		const once = withTree(collection, tree);
		expect(withTree(once, read(once))).toEqual(once);
	});
});

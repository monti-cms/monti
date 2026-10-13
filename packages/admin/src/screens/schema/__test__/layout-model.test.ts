import { describe, expect, it } from "vitest";
import { layoutGroupsOfSchema } from "../../entries/layout-groups";
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
	moveOutOfGroup,
	moveTab,
	placeField,
	placeUngrouped,
	removeGroup,
	removeTab,
	renameTab,
	type Tree,
	treeOf,
	withTree,
} from "../layout-model";
import { fieldsOf, layoutOf, type Obj } from "../schema-model";

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
		body: text("Body"),
		internal: text("Internal", { hidden: true }),
		seoTitle: text("SEO title", { tab: "SEO" }),
		...extra,
	},
	...(layout ? { layout } : {}),
});
const read = (collection: Obj) => treeOf(collection, DEFAULT);
const roundTrip = (collection: Obj, tree: Tree) => read(withTree(collection, tree));
/** The tree as plain rows: a group is `[title, fields]`, a run of fields in no group is `fields`. */
const shape = (tree: Tree) =>
	tree.tabs.map((tab) => ({
		tab: tab.name,
		blocks: tab.blocks.map((block) => (block.title === null ? block.fields : [block.title, block.fields])),
		locked: tab.locked,
	}));
/** What the real panel draws, in the shape the tests compare: groups per tab, in order. */
const panel = (collection: Obj) =>
	layoutGroupsOfSchema({
		fields: fieldsOf(collection) as Record<string, { tab?: string }>,
		...(layoutOf(collection).length > 0 ? { layout: layoutOf(collection) } : {}),
	})
		.map((group) => ({
			tab: group.tab ?? DEFAULT,
			group: group.group ?? null,
			fields: group.fields.filter((name) => !["title", "internal"].includes(name)),
		}))
		.filter((group) => group.fields.length > 0);

// Like the example Post: fields in no group first, then titled groups, then the rest.
const LEADING_RUN = [{ fields: ["slug", "summary"] }, { group: "Media", fields: ["cover"] }];

describe("layout tree", () => {
	it("pins the title and hidden fields, locks fields a plugin placed, and keeps the rest in one run", () => {
		const tree = read(post());
		expect(tree.pinned).toEqual(["title", "internal"]);
		expect(shape(tree)).toEqual([
			{ tab: DEFAULT, blocks: [["slug", "summary", "cover", "body"]], locked: [] },
			{ tab: "SEO", blocks: [], locked: ["seoTitle"] },
		]);
		expect(hasTabLevel(tree)).toBe(true);
		expect(hasTabLevel(read({ ...post(), fields: { title: text("Title"), slug: text("Slug") } }))).toBe(false);
	});

	it("shows a run of fields in no group where the panel draws it: before, between and after groups", () => {
		const collection = post([
			{ fields: ["slug", "summary"] },
			{ group: "Media", fields: ["cover"] },
			{ fields: ["body"] },
		]);
		expect(shape(read(collection))[0]?.blocks).toEqual([["slug", "summary"], ["Media", ["cover"]], ["body"]]);
		// What the tree shows first is what the panel shows first.
		expect(panel(collection)[0]).toEqual({ tab: DEFAULT, group: null, fields: ["slug", "summary"] });
	});

	it("puts fields that are in no layout group last in the default tab, after the groups", () => {
		const tree = read(post(LEADING_RUN));
		expect(shape(tree)[0]?.blocks).toEqual([["slug", "summary"], ["Media", ["cover"]], ["body"]]);
	});

	it("reads groups into their tabs", () => {
		const tree = read(
			post([
				{ group: "Media", fields: ["cover"], collapsed: true },
				{ fields: ["summary"], tab: "More" },
				{ group: "Extra", fields: ["slug", "nope"], tab: "More" },
			]),
		);
		expect(shape(tree)).toEqual([
			{ tab: DEFAULT, blocks: [["Media", ["cover"]], ["body"]], locked: [] },
			{ tab: "More", blocks: [["summary"], ["Extra", ["slug"]]], locked: [] },
			{ tab: "SEO", blocks: [], locked: ["seoTitle"] },
		]);
		expect(tree.tabs[0]?.blocks[0]?.collapsed).toBe(true);
	});

	it("never puts the title, a hidden field or a locked field in a group", () => {
		const tree = read(post([{ group: "A", fields: ["title", "internal", "seoTitle", "summary"] }]));
		expect(tree.tabs[0]?.blocks[0]?.fields).toEqual(["summary"]);
		expect(tree.pinned).toEqual(["title", "internal"]);
		expect(tree.tabs[1]?.locked).toEqual(["seoTitle"]);
	});

	it("saves what it read without changing what the panel draws, whatever the layout looks like", () => {
		for (const layout of [
			undefined,
			LEADING_RUN,
			[
				{ fields: ["slug"] },
				{ group: "A", fields: ["summary"] },
				{ fields: ["cover"] },
				{ group: "B", fields: ["body"] },
			],
			[
				{ group: "A", fields: ["summary"], collapsed: true },
				{ fields: ["cover", "slug"], tab: "More" },
				{ group: "B", fields: ["body"], tab: "More" },
			],
		]) {
			const collection = post(layout);
			const saved = withTree(collection, read(collection));
			expect(panel(saved)).toEqual(panel(collection));
			expect(shape(read(saved))).toEqual(shape(read(collection)));
			// Saving twice changes nothing.
			expect(withTree(saved, read(saved))).toEqual(saved);
		}
	});

	it("leaves everything else where it is when one field moves", () => {
		const collection = post(LEADING_RUN);
		const before = panel(collection);
		const saved = withTree(collection, moveFieldBy(read(collection), "body", -1));
		const after = panel(saved);
		// `body` joined the group above it; the run before the groups is untouched.
		expect(after[0]).toEqual(before[0]);
		expect(after[1]).toEqual({ tab: DEFAULT, group: "Media", fields: ["cover", "body"] });
	});

	it("saves the order of the fields and the layout together, and reads the same tree back", () => {
		const collection = post();
		let tree = read(collection);
		tree = addGroup(tree, 0, "Media");
		tree = placeField(tree, "cover", 0, 1);
		tree = addTab(tree, "More");
		tree = addGroup(tree, 2, "Details");
		tree = placeField(tree, "summary", 2, 0);
		tree = moveFieldToTab(tree, "slug", 2);
		const saved = withTree(collection, tree);
		expect(Object.keys(fieldsOf(saved))).toEqual(["title", "internal", "body", "cover", "seoTitle", "summary", "slug"]);
		expect(saved.layout).toEqual([
			{ fields: ["body"] },
			{ group: "Media", fields: ["cover"] },
			{ fields: [], tab: "SEO" },
			{ group: "Details", fields: ["summary"], tab: "More" },
			{ fields: ["slug"], tab: "More" },
		]);
		expect(shape(roundTrip(collection, tree))).toEqual(shape(tree));
	});

	it("moves a field out of a group to just after it, and drops it between groups", () => {
		const collection = post([
			{ group: "A", fields: ["summary", "cover"] },
			{ group: "B", fields: ["slug"] },
		]);
		const tree = read(collection);
		expect(shape(moveOutOfGroup(tree, "cover"))[0]?.blocks).toEqual([
			["A", ["summary"]],
			["cover"],
			["B", ["slug"]],
			["body"],
		]);
		// A field already in no group stays.
		expect(shape(moveOutOfGroup(tree, "body"))).toEqual(shape(tree));
		// Dropped before the second group, it sits between the groups, in no group.
		expect(shape(placeUngrouped(tree, "slug", 0, 1))[0]?.blocks).toEqual([
			["A", ["summary", "cover"]],
			["slug"],
			["B", []],
			["body"],
		]);
	});

	it("moves a field into another group and out to no group, and reorders within a group", () => {
		const collection = post([
			{ group: "A", fields: ["summary", "cover"] },
			{ group: "B", fields: ["slug"] },
		]);
		let tree = dropFieldOnField(read(collection), "summary", "slug");
		expect(shape(tree)[0]?.blocks.slice(0, 2)).toEqual([
			["A", ["cover"]],
			["B", ["summary", "slug"]],
		]);
		tree = dropFieldOnField(tree, "cover", "summary");
		expect(shape(tree)[0]?.blocks[1]).toEqual(["B", ["cover", "summary", "slug"]]);
		// Dropping down within a group lands after, dropping up lands before.
		expect(shape(dropFieldOnField(tree, "cover", "slug"))[0]?.blocks[1]).toEqual(["B", ["summary", "slug", "cover"]]);
		tree = placeUngrouped(tree, "summary", 0);
		expect(shape(tree)[0]?.blocks.at(-1)).toEqual(["body", "summary"]);
	});

	it("moves a field one step, into the neighbouring group at the edge, and across tabs", () => {
		const collection = post([
			{ group: "A", fields: ["summary"] },
			{ group: "B", fields: ["cover"], tab: "More" },
		]);
		const tree = read(collection);
		// Down from the last field of A: A is the first block, the run of the rest is next.
		expect(shape(moveFieldBy(tree, "summary", 1))[0]?.blocks).toEqual([
			["A", []],
			["summary", "slug", "body"],
		]);
		expect(shape(moveFieldBy(tree, "summary", -1))).toEqual(shape(tree));
		// Past the end of a tab it goes on to the next one.
		const last = moveFieldBy(moveFieldBy(moveFieldBy(moveFieldBy(tree, "body", 1), "body", 1), "body", 1), "body", 1);
		expect(placeUp(last, "body")).toBe(true);
	});

	it("adds, renames, collapses and deletes a group; deleting leaves its fields in place, in no group", () => {
		let tree = addGroup(read(post()), 0, "New");
		tree = editGroup(tree, { tab: 0, block: 1 }, { title: "Renamed", collapsed: true });
		expect(tree.tabs[0]?.blocks[1]).toEqual({ title: "Renamed", collapsed: true, fields: [] });
		expect(editGroup(tree, { tab: 0, block: 1 }, { title: "  " }).tabs[0]?.blocks[1]?.title).toBe("Renamed");
		tree = placeField(tree, "cover", 0, 1);
		expect(withTree(post(), tree).layout).toEqual([
			{ fields: ["slug", "summary", "body"] },
			{ group: "Renamed", fields: ["cover"], collapsed: true },
			{ fields: [], tab: "SEO" },
		]);
		tree = editGroup(tree, { tab: 0, block: 1 }, { collapsed: false });
		expect(tree.tabs[0]?.blocks[1]?.collapsed).toBeUndefined();
		// Deleting gives the fields back, still where the group was.
		expect(shape(removeGroup(tree, { tab: 0, block: 1 }))[0]?.blocks).toEqual([["slug", "summary", "body", "cover"]]);
	});

	it("reorders groups with their fields, passing the runs between them", () => {
		const collection = post([
			{ group: "A", fields: ["summary"] },
			{ group: "B", fields: ["cover"] },
			{ group: "C", fields: ["slug"], tab: "More" },
		]);
		const tree = read(collection);
		expect(shape(moveGroup(tree, { tab: 0, block: 0 }, { tab: 0, block: 1 }))[0]?.blocks.slice(0, 2)).toEqual([
			["B", ["cover"]],
			["A", ["summary"]],
		]);
		expect(shape(moveGroupBy(tree, { tab: 0, block: 1 }, -1))[0]?.blocks[0]).toEqual(["B", ["cover"]]);
		const moved = moveGroupToTab(tree, { tab: 0, block: 0 }, 1);
		expect(shape(moved)[0]?.blocks).toEqual([["B", ["cover"]], ["body"]]);
		expect(shape(moved)[1]?.blocks).toEqual([
			["C", ["slug"]],
			["A", ["summary"]],
		]);
		expect(shape(roundTrip(collection, moved))).toEqual(shape(moved));
	});

	it("adds, renames, reorders and removes tabs; the default tab and a tab a plugin fills stay", () => {
		let tree = read({ ...post(), fields: { title: text("Title"), slug: text("Slug"), cover: text("Cover") } });
		tree = addTab(tree, "More");
		tree = addTab(tree, "Other");
		expect(addTab(tree, "More").tabs).toHaveLength(3);
		expect(addTab(tree, "  ").tabs).toHaveLength(3);
		tree = moveTab(tree, 2, -1);
		expect(tree.tabs.map((tab) => tab.name)).toEqual([DEFAULT, "Other", "More"]);
		expect(moveTab(tree, 1, -1).tabs[0]?.name).toBe(DEFAULT);
		tree = renameTab(tree, 1, "Renamed");
		expect(tree.tabs[1]?.name).toBe("Renamed");
		expect(renameTab(tree, 0, "X").tabs[0]?.name).toBe(DEFAULT);
		tree = addGroup(tree, 1, "G");
		tree = placeField(moveFieldToTab(tree, "cover", 1), "cover", 1, 0);
		tree = removeTab(tree, 1);
		expect(shape(tree)[0]?.blocks).toEqual([["slug"], ["G", ["cover"]]]);
		expect(tree.tabs.map((tab) => tab.name)).toEqual([DEFAULT, "More"]);

		const seo = read(post());
		expect(removeTab(seo, 1).tabs).toHaveLength(2);
		expect(renameTab(seo, 1, "Other").tabs[1]?.name).toBe("SEO");
	});

	it("keeps an empty tab alive through the file", () => {
		const base = { ...post(), fields: { title: text("Title"), slug: text("Slug") } };
		const saved = withTree(base, addTab(read(base), "Later"));
		expect(saved.layout).toEqual([{ fields: [], tab: "Later" }]);
		expect(read(saved).tabs.map((tab) => tab.name)).toEqual([DEFAULT, "Later"]);
	});
});

/** Whether the field sits in a tab after the first one. */
const placeUp = (tree: Tree, name: string) =>
	tree.tabs.slice(1).some((tab) => tab.blocks.some((block) => block.fields.includes(name)));

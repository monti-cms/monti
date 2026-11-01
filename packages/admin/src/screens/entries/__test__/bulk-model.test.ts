import type { ListEntriesItem } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { bulkActionsFor } from "../bulk-bar";
import { archiveAction, canPublish, changeableRelations, heldIds, holding, sharedValue } from "../bulk-model";

const row = (id: string, patch: Partial<ListEntriesItem> = {}) =>
	({ id, status: "draft", hasUnpublishedChanges: false, relations: {}, ...patch }) as ListEntriesItem;
const held = (field: string, ...ids: string[]) => ({ [field]: ids.map((id) => ({ id, title: id })) });

describe("the relation fields a bulk change can reach", () => {
	it("LIST-C4 are the collection's own, in schema order, with whether they hold many and are required", () => {
		expect(changeableRelations(testSite, "post").map(({ name, many, required }) => [name, many, required])).toEqual([
			["categoryId", false, true],
			["tagIds", true, false],
		]);
	});

	it("LIST-C4 leave out a backlink and a field that only exists inside a conditional branch", () => {
		const names = changeableRelations(testSite, "post").map((field) => field.name);
		expect(names).not.toContain("series");
		expect(names).not.toContain("replacementPostId");
	});

	it("LIST-C4 are none for what is not a collection", () => {
		expect(changeableRelations(testSite, "nope")).toEqual([]);
	});
});

describe("what the picked rows hold", () => {
	const rows = [row("a", { relations: held("tagIds", "t1", "t2") }), row("b", { relations: held("tagIds", "t1") })];

	it("LIST-C4 counts the rows that hold a value: all, some or none", () => {
		expect(holding(rows, "tagIds", "t1")).toEqual({ state: "all", count: 2 });
		expect(holding(rows, "tagIds", "t2")).toEqual({ state: "some", count: 1 });
		expect(holding(rows, "tagIds", "t3")).toEqual({ state: "none", count: 0 });
	});

	it("LIST-C4 lists every id any row holds, once", () => {
		expect(heldIds(rows, "tagIds")).toEqual(["t1", "t2"]);
	});

	it("LIST-C4 shares a one-value field only when every row holds the same single value", () => {
		const same = [row("a", { relations: held("categoryId", "c1") }), row("b", { relations: held("categoryId", "c1") })];
		expect(sharedValue(same, "categoryId")).toBe("c1");
		expect(sharedValue([...same, row("c")], "categoryId")).toBeNull();
		expect(
			sharedValue([same[0] as ListEntriesItem, row("d", { relations: held("categoryId", "c2") })], "categoryId"),
		).toBeNull();
	});
});

describe("publish and archive for the picked rows", () => {
	it("LIST-C5 publishes a draft and a published row with changes, not a published row without, nor an archived one", () => {
		expect(canPublish([row("a")])).toBe(true);
		expect(canPublish([row("a", { status: "published", hasUnpublishedChanges: true })])).toBe(true);
		expect(canPublish([row("a", { status: "published" }), row("b", { status: "archived" })])).toBe(false);
	});

	it("LIST-C5 takes the archive off only when every row is archived", () => {
		expect(archiveAction([row("a", { status: "archived" }), row("b", { status: "archived" })])).toBe("unarchive");
		expect(archiveAction([row("a", { status: "archived" }), row("b")])).toBe("archive");
	});
});

describe("what the bar offers", () => {
	const ask = (rows: ListEntriesItem[], over: Partial<Parameters<typeof bulkActionsFor>[0]> = {}) =>
		bulkActionsFor({ site: testSite, collection: "post", rows, hasFolders: true, ...over });

	it("LIST-C5 puts publish, archive, the folder and 바꾸기 on the bar, and export and the trash in the ⋯", () => {
		expect(ask([row("a")])).toEqual({
			primary: ["publish", "archive", "folder.move", "change"],
			more: ["export", "trash"],
		});
	});

	it("LIST-C5 leaves out the folder where the list has none", () => {
		expect(ask([row("a")], { hasFolders: false }).primary).toEqual(["publish", "archive", "change"]);
	});

	it("LIST-C5 gives an item collection no publish or archive, and 바꾸기 only when it has a relation field", () => {
		const items = (name: string) => [row("a", { collection: name, status: "published" })];
		for (const name of testSite.COLLECTIONS.filter((candidate) => testSite.isItemCollection(candidate))) {
			const { primary } = ask(items(name), { collection: name, hasFolders: false });
			expect(primary).not.toContain("publish");
			expect(primary).not.toContain("archive");
			expect(primary.includes("change")).toBe(
				testSite.storedFields(name).some(({ field, when }) => field.kind === "relation" && !when),
			);
		}
	});

	it("LIST-C5 offers an item collection that has folders the folder move, and no publishing", () => {
		for (const name of testSite.COLLECTIONS.filter((candidate) => testSite.isItemCollection(candidate))) {
			const { primary } = ask([row("a", { collection: name })], { collection: name, hasFolders: true });
			expect(primary).toContain("folder.move");
			expect(primary).not.toContain("publish");
		}
	});
});

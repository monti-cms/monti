import type { ListEntriesItem } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { archiveAction, canPublish, changeableRelations, heldIds, holding, sharedValue } from "../bulk-model";

const row = (id: string, patch: Partial<ListEntriesItem> = {}) =>
	({ id, status: "draft", hasUnpublishedChanges: false, relations: {}, ...patch }) as ListEntriesItem;
const held = (field: string, ...ids: string[]) => ({ [field]: ids.map((id) => ({ id, title: id })) });

describe("the relation fields a bulk change can reach", () => {
	it("are the collection's own, in schema order, with whether they hold many and are required", () => {
		expect(changeableRelations(testSite, "post").map(({ name, many, required }) => [name, many, required])).toEqual([
			["categoryId", false, true],
			["tagIds", true, false],
		]);
	});

	it("leave out a backlink and a field that only exists inside a conditional branch", () => {
		const names = changeableRelations(testSite, "post").map((field) => field.name);
		expect(names).not.toContain("series");
		expect(names).not.toContain("replacementPostId");
	});

	it("are none for what is not a collection", () => {
		expect(changeableRelations(testSite, "nope")).toEqual([]);
	});
});

describe("what the picked rows hold", () => {
	const rows = [row("a", { relations: held("tagIds", "t1", "t2") }), row("b", { relations: held("tagIds", "t1") })];

	it("counts the rows that hold a value: all, some or none", () => {
		expect(holding(rows, "tagIds", "t1")).toEqual({ state: "all", count: 2 });
		expect(holding(rows, "tagIds", "t2")).toEqual({ state: "some", count: 1 });
		expect(holding(rows, "tagIds", "t3")).toEqual({ state: "none", count: 0 });
	});

	it("lists every id any row holds, once", () => {
		expect(heldIds(rows, "tagIds")).toEqual(["t1", "t2"]);
	});

	it("shares a one-value field only when every row holds the same single value", () => {
		const same = [row("a", { relations: held("categoryId", "c1") }), row("b", { relations: held("categoryId", "c1") })];
		expect(sharedValue(same, "categoryId")).toBe("c1");
		expect(sharedValue([...same, row("c")], "categoryId")).toBeNull();
		expect(
			sharedValue([same[0] as ListEntriesItem, row("d", { relations: held("categoryId", "c2") })], "categoryId"),
		).toBeNull();
	});
});

describe("publish and archive for the picked rows", () => {
	it("publishes a draft and a published row with changes, not a published row without, nor an archived one", () => {
		expect(canPublish([row("a")])).toBe(true);
		expect(canPublish([row("a", { status: "published", hasUnpublishedChanges: true })])).toBe(true);
		expect(canPublish([row("a", { status: "published" }), row("b", { status: "archived" })])).toBe(false);
	});

	it("takes the archive off only when every row is archived", () => {
		expect(archiveAction([row("a", { status: "archived" }), row("b", { status: "archived" })])).toBe("unarchive");
		expect(archiveAction([row("a", { status: "archived" }), row("b")])).toBe("archive");
	});
});

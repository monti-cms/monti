import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { describe, expect, it } from "vitest";
import { applyOptimistic, type EntriesPage, type OptimisticContext } from "../list-cache";

const row = (id: string, patch: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	trashedAt: null,
	...patch,
});

const page = (items: ListEntriesItem[], total = items.length): EntriesPage => ({ items, total });
const state: OptimisticContext["state"] = { statuses: [], folder: "all", includeDescendants: false };
const ids = (...values: string[]) => new Set(values);

describe("optimistic list update", () => {
	it("trash move, permanent delete and restore remove the row right away and reduce the total", () => {
		for (const op of ["trash", "permanentDelete", "restore"] as const) {
			const next = applyOptimistic(page([row("a"), row("b"), row("c")], 30), op, ids("a", "c"), { state });
			expect(next.items.map((item) => item.id)).toEqual(["b"]);
			expect(next.total).toBe(28);
		}
	});

	it("rows leaving the status filter are removed, and remaining rows only change status", () => {
		const items = [row("a"), row("b")];
		expect(applyOptimistic(page(items), "archive", ids("a"), { state }).items[0]?.status).toBe("archived");
		const filtered = applyOptimistic(page(items), "archive", ids("a"), { state: { ...state, statuses: ["draft"] } });
		expect(filtered.items.map((item) => item.id)).toEqual(["b"]);
	});

	it("a row moved to another folder leaves the current folder view", () => {
		const items = [row("a", { folderId: "f1" }), row("b", { folderId: "f1" })];
		const inFolder = { ...state, folder: "f1" };
		expect(
			applyOptimistic(page(items), "folder.move", ids("a"), { state: inFolder, params: { folderId: "f2" } }).items,
		).toHaveLength(1);
		expect(
			applyOptimistic(page(items), "folder.move", ids("a"), { state, params: { folderId: "f2" } }).items[0]?.folderId,
		).toBe("f2");
	});

	it("relation fields add, remove and replace, filling in names too", () => {
		const options = { tagIds: [{ id: "t1", title: "React" }], categoryId: [{ id: "c1", title: "개발" }] };
		const added = applyOptimistic(page([row("a")]), "relation.add", ids("a"), {
			state,
			params: { field: "tagIds", ids: ["t1"] },
			options,
		});
		expect(added.items[0]?.relations.tagIds).toEqual([{ id: "t1", title: "React" }]);
		const removed = applyOptimistic(added, "relation.remove", ids("a"), {
			state,
			params: { field: "tagIds", ids: ["t1"] },
		});
		expect(removed.items[0]?.relations.tagIds).toEqual([]);
		const set = applyOptimistic(page([row("a")]), "relation.set", ids("a"), {
			state,
			params: { field: "categoryId", id: "c1" },
			options,
		});
		expect(set.items[0]?.relations.categoryId).toEqual([{ id: "c1", title: "개발" }]);
		const cleared = applyOptimistic(set, "relation.set", ids("a"), {
			state,
			params: { field: "categoryId", id: null },
		});
		expect(cleared.items[0]?.relations.categoryId).toEqual([]);
	});
});

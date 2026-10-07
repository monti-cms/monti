import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { actionTargets, type RowMenuContext, type RowMenuHandlers, rowMenuActions } from "../list-row-menu";
import type { MenuAction } from "../shared/action-menu";

const item = (id: string, status: ListEntriesItem["status"] = "draft") =>
	({ id, title: id, status, version: 2 }) as ListEntriesItem;
const context: RowMenuContext = {
	mode: "list",
	isRecord: false,
	isContent: true,
	folders: [{ id: "f1", collection: "post", parentId: null, name: "뉴스", position: 0, version: 1 }],
	collection: "post",
	options: { tagIds: [{ id: "t1", title: "React", slug: "react" }] },
};
const handlers = (): RowMenuHandlers => ({
	openEditor: vi.fn(),
	openInNewTab: vi.fn(),
	openRecord: vi.fn(),
	duplicate: vi.fn(),
	restore: vi.fn(),
	confirmTrash: vi.fn(),
	confirmArchive: vi.fn(),
	confirmPermanentDelete: vi.fn(),
	bulk: vi.fn(),
});
const labels = (actions: MenuAction[]) => actions.map((action) => ("label" in action ? action.label : "—"));
const select = (actions: MenuAction[], ...path: string[]) => {
	let current = actions;
	for (const [index, label] of path.entries()) {
		const found = current.find((action) => "label" in action && action.label === label);
		if (!found) throw new Error(`no ${label}`);
		if (index === path.length - 1 && found.kind === "item") return found.onSelect();
		if (found.kind === "sub") current = found.items;
	}
};

describe("row menu target", () => {
	const rows = [item("a"), item("b"), item("c")];

	it("pressing one of the selected rows targets all selected rows", () => {
		expect(actionTargets(rows[1] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual([
			"a",
			"b",
		]);
	});

	it("an unselected row, or the only selected row, targets just that row", () => {
		expect(actionTargets(rows[2] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual(["c"]);
		expect(actionTargets(rows[0] as ListEntriesItem, rows, new Set(["a"])).map((row) => row.id)).toEqual(["a"]);
	});
});

describe("row menu items", () => {
	it("a single post row offers open and duplicate plus folder, tag, archive and trash", () => {
		const list = labels(rowMenuActions(testSite, [item("a")], context, handlers()));
		for (const label of ["열기", "복제", "폴더로 이동", "태그 추가", "보관", "휴지통으로 이동"]) {
			expect(list).toContain(label);
		}
		// The destructive action comes last.
		expect(list.at(-1)).toBe("휴지통으로 이동");
	});

	it("multiple rows show the item count first and have no open or duplicate", () => {
		const list = labels(rowMenuActions(testSite, [item("a"), item("b")], context, handlers()));
		expect(list[0]).toBe("2개 항목");
		expect(list).not.toContain("열기");
		expect(list).not.toContain("복제");
	});

	it("rows that are all archived offer unarchive", () => {
		const on = handlers();
		select(rowMenuActions(testSite, [item("a", "archived")], context, on), "보관 해제");
		expect(on.bulk).toHaveBeenCalledWith("unarchive", "보관 해제", [{ id: "a", expectedVersion: 2, title: "a" }]);
	});

	it("archive asks for confirmation instead of acting right away", () => {
		const on = handlers();
		select(rowMenuActions(testSite, [item("a")], context, on), "보관");
		expect(on.confirmArchive).toHaveBeenCalledWith([{ id: "a", expectedVersion: 2, title: "a" }]);
		expect(on.bulk).not.toHaveBeenCalled();
	});

	it("a taxonomy item opens as a small form and has no tag or archive", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a")], { ...context, isRecord: true, isContent: false }, on);
		const list = labels(actions);
		expect(list).toContain("열기");
		expect(list).not.toContain("태그 추가");
		expect(list).not.toContain("보관");
		select(actions, "열기");
		expect(on.openRecord).toHaveBeenCalledWith(item("a"));
	});

	it("folder and tag submenus call the bulk action with the chosen targets and value", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a"), item("b")], context, on);
		const targets = [
			{ id: "a", expectedVersion: 2, title: "a" },
			{ id: "b", expectedVersion: 2, title: "b" },
		];
		select(actions, "폴더로 이동", "최상위");
		select(actions, "폴더로 이동", "뉴스");
		select(actions, "태그 추가", "React");
		expect(on.bulk).toHaveBeenNthCalledWith(1, "folder.move", "옮김", targets, { folderId: null });
		expect(on.bulk).toHaveBeenNthCalledWith(2, "folder.move", "옮김", targets, { folderId: "f1" });
		expect(on.bulk).toHaveBeenNthCalledWith(3, "relation.add", "태그를 추가", targets, {
			field: "tagIds",
			ids: ["t1"],
		});
	});

	it("trash has only restore and permanent delete", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a", "trashed")], { ...context, mode: "trash" }, on);
		const list = labels(actions);
		expect(list).toContain("복원");
		expect(list).toContain("영구 삭제");
		for (const label of ["보관", "폴더로 이동", "태그 추가"]) expect(list).not.toContain(label);
		select(actions, "영구 삭제");
		expect(on.confirmPermanentDelete).toHaveBeenCalledWith([{ id: "a", expectedVersion: 2, title: "a" }]);
	});
});

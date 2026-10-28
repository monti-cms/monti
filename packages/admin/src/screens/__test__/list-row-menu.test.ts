import type { ListEntriesItem } from "@monti-cms/core/site";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { actionTargets, type RowMenuContext, type RowMenuHandlers, rowMenuActions } from "../list-row-menu";
import { screensMessages } from "../messages";
import type { MenuAction } from "../shared/action-menu";

const item = (id: string, status: ListEntriesItem["status"] = "draft", changed = false) =>
	({ id, title: id, status, version: 2, hasUnpublishedChanges: changed, relations: {} }) as ListEntriesItem;
const context: RowMenuContext = {
	mode: "list",
	isRecord: false,
	isContent: true,
	folders: [{ id: "f1", collection: "post", parentId: null, name: "뉴스", position: 0, version: 1 }],
	collection: "post",
};
const handlers = (): RowMenuHandlers => ({
	openEditor: vi.fn(),
	openInNewTab: vi.fn(),
	openRecord: vi.fn(),
	duplicate: vi.fn(),
	restore: vi.fn(),
	confirmPublish: vi.fn(),
	exportEntries: vi.fn(),
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
	it("offers moving to a folder only where the list has folders", () => {
		const move = testSite.createTranslator(screensMessages)("menu.moveToFolder");
		const withFolders = labels(rowMenuActions(testSite, [item("a")], context, handlers()));
		const without = labels(rowMenuActions(testSite, [item("a")], { ...context, folders: null }, handlers()));
		expect(withFolders).toContain(move);
		expect(without).not.toContain(move);
		// An empty folder list is still a list with folders: the move offers the top level.
		expect(labels(rowMenuActions(testSite, [item("a")], { ...context, folders: [] }, handlers()))).toContain(move);
	});

	it("a single post row offers open and duplicate, the folder and each relation field it can change, archive and the trash", () => {
		const list = labels(rowMenuActions(testSite, [item("a")], context, handlers()));
		for (const label of ["열기", "복제", "폴더로", "카테고리", "태그", "보관", "휴지통으로"]) {
			expect(list).toContain(label);
		}
		// The fields are rows of their own, not an "add a tag" row, and the destructive action comes last.
		expect(list).not.toContain("태그 추가");
		expect(list.indexOf("폴더로")).toBeLessThan(list.indexOf("카테고리"));
		expect(list.indexOf("태그")).toBeLessThan(list.indexOf("보관"));
		expect(list.at(-1)).toBe("휴지통으로");
	});

	it("offers only the relation fields a bulk change can reach: not a backlink, not a field inside a conditional branch", () => {
		const fields = rowMenuActions(testSite, [item("a")], context, handlers()).filter(
			(action) => action.kind === "choice",
		);
		expect(labels(fields)).toEqual(["카테고리", "태그"]);
	});

	it("multiple rows show the item count first and have no open or duplicate", () => {
		const list = labels(rowMenuActions(testSite, [item("a"), item("b")], context, handlers()));
		expect(list[0]).toBe("2개 항목");
		expect(list).not.toContain("열기");
		expect(list).not.toContain("복제");
	});

	it("several rows list publish, archive, the folder, the fields, export and the trash in that order, with the fields at the second level", () => {
		const list = labels(rowMenuActions(testSite, [item("a"), item("b")], context, handlers()));
		expect(list.filter((label) => label !== "—")).toEqual([
			"2개 항목",
			"발행",
			"보관",
			"폴더로",
			"카테고리",
			"태그",
			"내보내기",
			"휴지통으로",
		]);
		expect(list).not.toContain("바꾸기");
	});

	it("leaves publish out when every row is published without changes, and keeps it for a published row with changes", () => {
		const published = [item("a", "published"), item("b", "published")];
		expect(labels(rowMenuActions(testSite, published, context, handlers()))).not.toContain("발행");
		const editing = [item("a", "published"), item("b", "published", true)];
		expect(labels(rowMenuActions(testSite, editing, context, handlers()))).toContain("발행");
	});

	it("publish asks, and export opens the export of the rows", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a"), item("b")], context, on);
		select(actions, "발행");
		expect(on.confirmPublish).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a" }),
			expect.objectContaining({ id: "b" }),
		]);
		select(actions, "내보내기");
		expect(on.exportEntries).toHaveBeenCalledWith(["a", "b"]);
	});

	it("several archived rows offer to take the archive off instead", () => {
		const list = labels(rowMenuActions(testSite, [item("a", "archived"), item("b", "archived")], context, handlers()));
		expect(list).toContain("보관 해제");
		expect(list).not.toContain("보관");
		expect(list).not.toContain("발행");
	});

	it("rows that are all archived offer unarchive", () => {
		const on = handlers();
		select(rowMenuActions(testSite, [item("a", "archived")], context, on), "보관 해제");
		expect(on.bulk).toHaveBeenCalledWith("unarchive", "보관 해제", [
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
		]);
	});

	it("archive asks for confirmation instead of acting right away", () => {
		const on = handlers();
		select(rowMenuActions(testSite, [item("a")], context, on), "보관");
		expect(on.confirmArchive).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
		]);
		expect(on.bulk).not.toHaveBeenCalled();
	});

	it("a taxonomy item opens as a small form and has no archive", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a")], { ...context, isRecord: true, isContent: false }, on);
		const list = labels(actions);
		expect(list).toContain("열기");
		expect(list).not.toContain("보관");
		select(actions, "열기");
		expect(on.openRecord).toHaveBeenCalledWith(item("a"));
	});

	it("the folder submenu calls the bulk action with the chosen targets and folder", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a"), item("b")], context, on);
		const targets = [
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
			expect.objectContaining({ id: "b", expectedVersion: 2, title: "b" }),
		];
		select(actions, "폴더로", "최상위");
		select(actions, "폴더로", "뉴스");
		expect(on.bulk).toHaveBeenNthCalledWith(1, "folder.move", "옮김", targets, { folderId: null });
		expect(on.bulk).toHaveBeenNthCalledWith(2, "folder.move", "옮김", targets, { folderId: "f1" });
	});

	it("trash has only restore and permanent delete", () => {
		const on = handlers();
		const actions = rowMenuActions(testSite, [item("a", "trashed")], { ...context, mode: "trash" }, on);
		const list = labels(actions);
		expect(list).toContain("복원");
		expect(list).toContain("영구 삭제");
		for (const label of ["보관", "폴더로", "태그"]) expect(list).not.toContain(label);
		select(actions, "영구 삭제");
		expect(on.confirmPermanentDelete).toHaveBeenCalledWith([
			expect.objectContaining({ id: "a", expectedVersion: 2, title: "a" }),
		]);
	});
});

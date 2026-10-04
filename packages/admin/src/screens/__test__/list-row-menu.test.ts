import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { describe, expect, it, vi } from "vitest";
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

describe("행 메뉴 대상", () => {
	const rows = [item("a"), item("b"), item("c")];

	it("고른 줄 가운데 하나를 누르면 고른 줄 전체다", () => {
		expect(actionTargets(rows[1] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual([
			"a",
			"b",
		]);
	});

	it("고르지 않은 줄이나 하나만 고른 줄은 그 줄 하나다", () => {
		expect(actionTargets(rows[2] as ListEntriesItem, rows, new Set(["a", "b"])).map((row) => row.id)).toEqual(["c"]);
		expect(actionTargets(rows[0] as ListEntriesItem, rows, new Set(["a"])).map((row) => row.id)).toEqual(["a"]);
	});
});

describe("행 메뉴 항목", () => {
	it("글 한 줄은 열기·복제와 폴더·태그·보관·휴지통을 준다", () => {
		expect(labels(rowMenuActions([item("a")], context, handlers()))).toEqual([
			"열기",
			"새 탭에서 열기",
			"복제",
			"—",
			"폴더로 이동",
			"태그 추가",
			"—",
			"보관",
			"휴지통으로 이동",
		]);
	});

	it("여러 줄은 항목 수를 먼저 보이고 열기·복제가 없다", () => {
		expect(labels(rowMenuActions([item("a"), item("b")], context, handlers())).slice(0, 3)).toEqual([
			"2개 항목",
			"—",
			"폴더로 이동",
		]);
	});

	it("모두 보관된 줄이면 보관 해제를 준다", () => {
		const on = handlers();
		select(rowMenuActions([item("a", "archived")], context, on), "보관 해제");
		expect(on.bulk).toHaveBeenCalledWith("unarchive", "보관 해제", [{ id: "a", expectedVersion: 2, title: "a" }]);
	});

	it("보관은 바로 하지 않고 확인을 부른다", () => {
		const on = handlers();
		select(rowMenuActions([item("a")], context, on), "보관");
		expect(on.confirmArchive).toHaveBeenCalledWith([{ id: "a", expectedVersion: 2, title: "a" }]);
		expect(on.bulk).not.toHaveBeenCalled();
	});

	it("모든 항목과 하위 메뉴 항목에 아이콘이 있다", () => {
		const missing = (actions: MenuAction[]): string[] =>
			actions.flatMap((action) => {
				if (action.kind === "item") return action.icon ? [] : [action.label];
				if (action.kind === "sub") return [...(action.icon ? [] : [action.label]), ...missing(action.items)];
				return [];
			});
		expect(missing(rowMenuActions([item("a")], context, handlers()))).toEqual([]);
		expect(missing(rowMenuActions([item("a", "trashed")], { ...context, mode: "trash" }, handlers()))).toEqual([]);
	});

	it("분류 항목은 작은 폼으로 열고 태그·보관이 없다", () => {
		const on = handlers();
		const actions = rowMenuActions([item("a")], { ...context, isRecord: true, isContent: false }, on);
		expect(labels(actions)).toEqual(["열기", "—", "폴더로 이동", "—", "휴지통으로 이동"]);
		select(actions, "열기");
		expect(on.openRecord).toHaveBeenCalledWith(item("a"));
	});

	it("폴더·태그 하위 메뉴는 고른 대상과 값으로 일괄 작업을 부른다", () => {
		const on = handlers();
		const actions = rowMenuActions([item("a"), item("b")], context, on);
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

	it("휴지통은 복원·영구 삭제뿐이다", () => {
		const on = handlers();
		const actions = rowMenuActions([item("a", "trashed")], { ...context, mode: "trash" }, on);
		expect(labels(actions)).toEqual(["복원", "—", "영구 삭제"]);
		select(actions, "영구 삭제");
		expect(on.confirmPermanentDelete).toHaveBeenCalledWith([{ id: "a", expectedVersion: 2, title: "a" }]);
	});
});

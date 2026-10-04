import { Editor } from "@tiptap/core";
import { CellSelection, columnResizingPluginKey } from "@tiptap/pm/tables";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../extensions";

const cellPositions = (editor: Editor) => {
	const positions: number[] = [];
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === "tableCell" || node.type.name === "tableHeader") positions.push(pos);
		return node.type.name !== "tableCell" && node.type.name !== "tableHeader";
	});
	return positions;
};

describe("표 열 너비 조절 중 셀 선택 막기", () => {
	it("끄는 동안에는 선택만 바꾸는 트랜잭션을 버리고, 놓은 뒤에는 다시 받는다", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: "<table><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></table>",
		});
		const [first, , third] = cellPositions(editor);
		if (first === undefined || third === undefined) throw new Error("셀 없음");
		const selectCells = () =>
			editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, first, third)));

		editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setHandle: first }));
		editor.view.dispatch(
			editor.state.tr.setMeta(columnResizingPluginKey, { setDragging: { startX: 0, startWidth: 100 } }),
		);
		selectCells();
		expect(editor.state.selection).not.toBeInstanceOf(CellSelection);

		editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }));
		selectCells();
		expect(editor.state.selection).toBeInstanceOf(CellSelection);
		editor.destroy();
	});

	it("끄는 동안 표를 다시 그려도 끄는 너비(DOM)를 저장된 너비로 되돌리지 않는다", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: '<table><tr><td colwidth="100"><p>a</p></td><td colwidth="100"><p>b</p></td></tr></table><p>뒤</p>',
		});
		const [first] = cellPositions(editor);
		if (first === undefined) throw new Error("셀 없음");
		const col = editor.view.dom.querySelector("col") as HTMLTableColElement;
		let tablePos = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "table") tablePos = pos;
			return tablePos === -1;
		});
		// 표 노드를 바꾸는 트랜잭션: TableView.update가 불린다.
		const touchTable = () =>
			editor.view.dispatch(
				editor.state.tr.setNodeAttribute(
					tablePos,
					"align",
					editor.state.doc.nodeAt(tablePos)?.attrs.align ? null : "x",
				),
			);

		editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setHandle: first }));
		editor.view.dispatch(
			editor.state.tr.setMeta(columnResizingPluginKey, { setDragging: { startX: 0, startWidth: 100 } }),
		);
		col.style.width = "180px"; // prosemirror-tables가 끄는 동안 DOM에만 적는 너비
		touchTable();
		expect(col.style.width).toBe("180px");

		editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }));
		touchTable();
		expect(col.style.width).toBe("100px");
		editor.destroy();
	});

	it("열 너비를 지우면(폭 채우기) 화면의 옛 너비도 지운다", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: '<table><tr><td colwidth="160"><p>a</p></td><td colwidth="140"><p>b</p></td></tr></table>',
		});
		const tr = editor.state.tr;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "tableCell") tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: null });
		});
		editor.view.dispatch(tr);
		const cols = Array.from(editor.view.dom.querySelectorAll("col")) as HTMLElement[];
		expect(cols.map((col) => col.style.width)).toEqual(["", ""]);
		editor.destroy();
	});
});

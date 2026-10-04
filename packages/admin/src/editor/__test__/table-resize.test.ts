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

describe("blocking cell selection while resizing table columns", () => {
	it("drops selection-only transactions while dragging and accepts them again after release", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: "<table><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></table>",
		});
		const [first, , third] = cellPositions(editor);
		if (first === undefined || third === undefined) throw new Error("No cell");
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

	it("does not revert the dragged width (DOM) to the stored width when the table redraws during a drag", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: '<table><tr><td colwidth="100"><p>a</p></td><td colwidth="100"><p>b</p></td></tr></table><p>뒤</p>',
		});
		const [first] = cellPositions(editor);
		if (first === undefined) throw new Error("No cell");
		const col = editor.view.dom.querySelector("col") as HTMLTableColElement;
		let tablePos = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "table") tablePos = pos;
			return tablePos === -1;
		});
		// Transaction that changes the table node: TableView.update is called.
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
		col.style.width = "180px"; // Width prosemirror-tables writes only to the DOM during a drag
		touchTable();
		expect(col.style.width).toBe("180px");

		editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setDragging: null }));
		touchTable();
		expect(col.style.width).toBe("100px");
		editor.destroy();
	});

	it("clearing the column width (fill width) also clears the old width on screen", () => {
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

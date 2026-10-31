import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { buildEditorExtensions } from "../extensions";

describe("blocking cell selection while resizing table columns", () => {
	it("EDIT-T1 clearing the column width (fill width) also clears the old width on screen", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(testSite),
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

import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { deleteBlock } from "../../block-commands";
import { buildEditorExtensions } from "../../extensions";
import { targetBlockAt } from "../block-resolve";
import { canDropBlockNode } from "../drag-commands";

const create = (content: string) => new Editor({ extensions: buildEditorExtensions(testSite), content });
const OPAQUE = '<div data-cms-opaque="true" data-raw-source=":::callout\n내용\n:::" data-line-start="1"></div>';
const texts = (editor: Editor) => editor.state.doc.content.content.map((n) => `${n.type.name}:${n.textContent}`);

describe("review fixes", () => {
	it("the position just before an atom block points at that block (not the first block)", () => {
		const editor = create(`<p>첫</p>${OPAQUE}<p>끝</p>`);
		const pos = editor.state.doc.child(0).nodeSize;
		expect(targetBlockAt(editor.state.doc, pos)?.node.type.name).toBe("cmsOpaqueBlock");
		editor.destroy();
	});

	it("selecting an atom block and pressing the block delete shortcut removes only that block", () => {
		const editor = create(`<p>첫</p>${OPAQUE}<p>끝</p>`);
		const pos = editor.state.doc.child(0).nodeSize;
		editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
		deleteBlock(editor, editor.state.selection.from);
		expect(texts(editor)).toEqual(["paragraph:첫", "paragraph:끝"]);
		editor.destroy();
	});

	it("keyboard Alt+Down moves the top-level block (the whole list) even from inside a list", () => {
		const editor = create("<ul><li><p>가</p></li><li><p>나</p></li></ul><p>뒤</p>");
		editor.commands.setTextSelection(4);
		editor.commands.keyboardShortcut("Alt-ArrowDown");
		expect(editor.state.doc.child(0).textContent).toBe("뒤");
		expect(editor.state.doc.child(1).type.name).toBe("bulletList");
		editor.destroy();
	});

	it("does not move when the parent of the vacated spot would become empty (the only paragraph in a list item)", () => {
		const editor = create("<ul><li><p>가</p></li></ul><p>뒤</p>");
		// list(0) > item(1) > paragraph(2)
		expect(canDropBlockNode(editor.state.doc, 2, editor.state.doc.content.size)).toBe(false);
		editor.destroy();
	});
});

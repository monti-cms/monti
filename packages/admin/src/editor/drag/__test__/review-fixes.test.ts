import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { deleteBlock } from "../../block-commands";
import { buildEditorExtensions } from "../../extensions";
import { targetBlockAt } from "../block-resolve";
import { canDropBlockNode } from "../drag-commands";

const create = (content: string) => new Editor({ extensions: buildEditorExtensions(), content });
const OPAQUE = '<div data-cms-opaque="true" data-raw-source=":::callout\n내용\n:::" data-line-start="1"></div>';
const texts = (editor: Editor) => editor.state.doc.content.content.map((n) => `${n.type.name}:${n.textContent}`);

describe("C1 리뷰 수정", () => {
	it("원자 블록 바로 앞 위치는 그 블록을 가리킨다(첫 블록이 아니다)", () => {
		const editor = create(`<p>첫</p>${OPAQUE}<p>끝</p>`);
		const pos = editor.state.doc.child(0).nodeSize;
		expect(targetBlockAt(editor.state.doc, pos)?.node.type.name).toBe("cmsOpaqueBlock");
		editor.destroy();
	});

	it("원자 블록을 선택하고 블록 삭제 단축키를 누르면 그 블록만 지운다", () => {
		const editor = create(`<p>첫</p>${OPAQUE}<p>끝</p>`);
		const pos = editor.state.doc.child(0).nodeSize;
		editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
		deleteBlock(editor, editor.state.selection.from);
		expect(texts(editor)).toEqual(["paragraph:첫", "paragraph:끝"]);
		editor.destroy();
	});

	it("키보드 Alt+↓는 목록 안에서도 최상위 블록(목록 전체)을 옮긴다", () => {
		const editor = create("<ul><li><p>가</p></li><li><p>나</p></li></ul><p>뒤</p>");
		editor.commands.setTextSelection(4);
		editor.commands.keyboardShortcut("Alt-ArrowDown");
		expect(editor.state.doc.child(0).textContent).toBe("뒤");
		expect(editor.state.doc.child(1).type.name).toBe("bulletList");
		editor.destroy();
	});

	it("꺼낸 자리의 부모가 비게 되면(목록 항목의 하나뿐인 문단) 옮기지 않는다", () => {
		const editor = create("<ul><li><p>가</p></li></ul><p>뒤</p>");
		// 목록(0) > 항목(1) > 문단(2)
		expect(canDropBlockNode(editor.state.doc, 2, editor.state.doc.content.size)).toBe(false);
		editor.destroy();
	});
});

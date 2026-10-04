import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../extensions";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const open = (mdx: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(mdx) });
	return editor;
};

const typeAt = (current: Editor, pos: number, text: string) => {
	current.commands.setTextSelection(pos);
	const { view } = current;
	const handled = view.someProp("handleTextInput", (handler) => handler(view, pos, pos, text, () => view.state.tr));
	if (!handled) current.commands.insertContent(text);
};

describe("번역 안내 글 편집(v3)", () => {
	it("안내 글이 있는 블록에 입력하면 안내 글을 지우고 입력한다", () => {
		const current = open(":untranslated[첫 문단]\n\n:untranslated[둘째 문단]\n");
		typeAt(current, 3, "F");
		expect(tiptapToMdx(current.getJSON())).toBe("F\n\n:untranslated[둘째 문단]\n");
	});

	it("지우기를 누르면 그 블록의 안내 글을 한 번에 지운다", () => {
		const current = open(":untranslated[첫 문단]\n");
		current.commands.setTextSelection(4);
		const { view } = current;
		view.someProp("handleKeyDown", (handler) => handler(view, new KeyboardEvent("keydown", { key: "Backspace" })));
		expect(tiptapToMdx(current.getJSON())).toBe("");
	});

	it("안내 글이 없는 블록은 평소대로 입력한다", () => {
		const current = open("번역 끝\n");
		typeAt(current, 2, "X");
		expect(tiptapToMdx(current.getJSON())).toContain("X");
		expect(tiptapToMdx(current.getJSON())).not.toContain("untranslated");
	});
});

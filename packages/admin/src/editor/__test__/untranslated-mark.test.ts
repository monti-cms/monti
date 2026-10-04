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

describe("editing untranslated notice text", () => {
	it("typing in a block with notice text clears the notice text and enters the input", () => {
		const current = open(":untranslated[첫 문단]\n\n:untranslated[둘째 문단]\n");
		typeAt(current, 3, "F");
		expect(tiptapToMdx(current.getJSON())).toBe("F\n\n:untranslated[둘째 문단]\n");
	});

	it("pressing clear removes the block's notice text at once", () => {
		const current = open(":untranslated[첫 문단]\n");
		current.commands.setTextSelection(4);
		const { view } = current;
		view.someProp("handleKeyDown", (handler) => handler(view, new KeyboardEvent("keydown", { key: "Backspace" })));
		expect(tiptapToMdx(current.getJSON())).toBe("");
	});

	it("a block without notice text accepts input as usual", () => {
		const current = open("번역 끝\n");
		typeAt(current, 2, "X");
		expect(tiptapToMdx(current.getJSON())).toContain("X");
		expect(tiptapToMdx(current.getJSON())).not.toContain("untranslated");
	});
});

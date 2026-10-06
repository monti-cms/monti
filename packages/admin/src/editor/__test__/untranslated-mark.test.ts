import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { storedDoc, text } from "../../test/stored-doc";
import { buildEditorExtensions } from "../extensions";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const untranslated = (value: string) => ({
	type: "paragraph",
	content: [text(value, [{ type: "untranslated" }])],
});
const plain = (value: string) => ({ type: "paragraph", content: [text(value)] });

const open = (...content: Parameters<typeof storedDoc>) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: storedToTiptap(storedDoc(...content)) });
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
		const current = open(untranslated("첫 문단"), untranslated("둘째 문단"));
		typeAt(current, 3, "F");
		expect(tiptapToStored(current.getJSON()).content).toMatchObject([plain("F"), untranslated("둘째 문단")]);
	});

	it("pressing clear removes the block's notice text at once", () => {
		const current = open(untranslated("첫 문단"));
		current.commands.setTextSelection(4);
		const { view } = current;
		view.someProp("handleKeyDown", (handler) => handler(view, new KeyboardEvent("keydown", { key: "Backspace" })));
		expect(JSON.stringify(tiptapToStored(current.getJSON()))).not.toContain('"text"');
	});

	it("a block without notice text accepts input as usual", () => {
		const current = open(plain("번역 끝"));
		typeAt(current, 2, "X");
		const written = JSON.stringify(tiptapToStored(current.getJSON()));
		expect(written).toContain("X");
		expect(written).not.toContain("untranslated");
	});
});

import { createTranslator } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { deleteBlock, duplicateBlock, moveBlock, topLevelBlockAt } from "../block-commands";
import { isValidImageWidth } from "../image-node-view";
import { editorMessages } from "../messages";
import { prepareUpload } from "../upload-helper";

const t = createTranslator(editorMessages);

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const make = () => {
	editor = new Editor({ extensions: [StarterKit], content: "<p>A</p><h2>B</h2><p>C</p>" });
	return editor;
};
const texts = (instance: Editor) => instance.state.doc.content.content.map((node) => node.textContent);
const posOf = (instance: Editor, index: number) => {
	let pos = 1;
	for (let i = 0; i < index; i++) pos += instance.state.doc.child(i).nodeSize;
	return pos;
};

describe("top-level block operations", () => {
	it("finds the top-level block for a position inside it", () => {
		const instance = make();
		expect(topLevelBlockAt(instance.state.doc, posOf(instance, 1))?.node.type.name).toBe("heading");
	});

	it("moves, duplicates and deletes blocks without touching neighbours", () => {
		const instance = make();
		expect(moveBlock(instance, posOf(instance, 1), -1)).toBe(true);
		expect(texts(instance)).toEqual(["B", "A", "C"]);
		expect(moveBlock(instance, posOf(instance, 0), -1)).toBe(false);
		expect(moveBlock(instance, posOf(instance, 0), 1)).toBe(true);
		expect(texts(instance)).toEqual(["A", "B", "C"]);
		expect(duplicateBlock(instance, posOf(instance, 2))).toBe(true);
		expect(texts(instance)).toEqual(["A", "B", "C", "C"]);
		expect(deleteBlock(instance, posOf(instance, 1))).toBe(true);
		expect(texts(instance)).toEqual(["A", "C", "C"]);
	});
});

describe("nested block operations", () => {
	it("moves nested list items within parent list", () => {
		const listEditor = new Editor({
			extensions: [StarterKit],
			content: "<ul><li><p>Item 1</p></li><li><p>Item 2</p></li><li><p>Item 3</p></li></ul>",
		});
		const list = listEditor.state.doc.child(0);
		const item2Pos = 1 + list.child(0).nodeSize + 1;
		expect(moveBlock(listEditor, item2Pos, -1)).toBe(true);

		const updatedList = listEditor.state.doc.child(0);
		expect([
			updatedList.child(0).textContent,
			updatedList.child(1).textContent,
			updatedList.child(2).textContent,
		]).toEqual(["Item 2", "Item 1", "Item 3"]);

		listEditor.destroy();
	});
});

describe("image width and upload optimization", () => {
	it("accepts 1–100% or 1–4096px only", () => {
		for (const ok of ["", "1%", "100%", "600", "600px", "4096px"]) expect(isValidImageWidth(ok), ok).toBe(true);
		for (const bad of ["0%", "101%", "0px", "4097px", "50vw", "-1px"]) expect(isValidImageWidth(bad), bad).toBe(false);
	});

	it("keeps the original for GIF and when optimisation is off", async () => {
		const gif = new File([new Uint8Array([71, 73, 70])], "a.gif", { type: "image/gif" });
		expect(await prepareUpload(gif, { optimize: false })).toEqual({ file: gif, optimized: false });
		expect(await prepareUpload(gif, { optimize: true })).toMatchObject({
			file: gif,
			optimized: false,
			skippedReason: expect.any(String),
		});
	});

	it("never turns an animated WebP into a still image", async () => {
		const bytes = new Uint8Array(64);
		bytes.set([0x41, 0x4e, 0x49, 0x4d], 30);
		const webp = new File([bytes], "a.webp", { type: "image/webp" });
		expect(await prepareUpload(webp, { optimize: true })).toMatchObject({
			optimized: false,
			skippedReason: t("upload.keepAnimated"),
		});
	});
});

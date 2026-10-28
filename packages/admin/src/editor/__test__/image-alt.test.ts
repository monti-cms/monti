import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { buildEditorExtensions } from "../extensions";
import { imagesWithoutAlt, nextImageWithoutAlt } from "../image-alt";
import { folderNav } from "../image-insert-dialog";
import { tiptapToStored } from "../tiptap-content";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

const image = (id: string, attrs: Record<string, unknown> = {}) => ({
	type: "image",
	attrs: { [BLOCK_ID_ATTRIBUTE]: id, mediaId: `m-${id}`, alt: "", ...attrs },
});
const open = (...content: object[]) => {
	editor = new Editor({
		extensions: buildEditorExtensions(testSite),
		content: { type: "doc", content: [{ type: "paragraph" }, ...content] },
	});
	return editor;
};

describe("images that still need alt text", () => {
	it("lists the images without text in document order, leaving out decorative images and images still going up", () => {
		const { state } = open(
			image("aaaaaaaa"),
			image("bbbbbbbb", { alt: "with text" }),
			image("cccccccc", { decorative: true }),
			image("dddddddd", { uploadId: "u1", mediaId: null }),
			image("eeeeeeee"),
		);
		expect(imagesWithoutAlt(state.doc)).toEqual(["aaaaaaaa", "eeeeeeee"]);
	});

	it("goes to the next image without text after this one, then round to the first, and to none when no other image needs text", () => {
		const { state } = open(image("aaaaaaaa"), image("bbbbbbbb", { alt: "x" }), image("cccccccc"));
		expect(nextImageWithoutAlt(state.doc, "aaaaaaaa")).toBe("cccccccc");
		expect(nextImageWithoutAlt(state.doc, "cccccccc")).toBe("aaaaaaaa");
		// The image being edited counts as done: it is the others that are looked at.
		expect(nextImageWithoutAlt(state.doc, "bbbbbbbb")).toBe("cccccccc");
		const only = open(image("aaaaaaaa")).state.doc;
		expect(nextImageWithoutAlt(only, "aaaaaaaa")).toBeNull();
	});
});

describe("an image that is still going up", () => {
	it("is not part of the stored document until the upload has given it its media", () => {
		const { getJSON } = open(image("aaaaaaaa", { mediaId: null, uploadId: "u1" }), image("bbbbbbbb"));
		const stored = tiptapToStored(testSite, getJSON.call(editor));
		expect(stored.content.filter((node) => node.type === "image")).toHaveLength(1);
		expect(JSON.stringify(stored)).not.toContain("u1");
	});
});

describe("the folder list of the picker", () => {
	const folder = (id: string, parentId: string | null, position: number) =>
		({ id, name: id, parentId, position, collection: "media", version: 1, entryCount: 0 }) as const;

	it("lists each top folder with what is inside it right after it, by position", () => {
		const list = folderNav([
			folder("wall", null, 1),
			folder("diagrams", "blog", 1),
			folder("blog", null, 0),
			folder("covers", "blog", 0),
		]);
		expect(list.map((item) => [item.id, item.depth])).toEqual([
			["blog", 0],
			["covers", 1],
			["diagrams", 1],
			["wall", 0],
		]);
	});
});

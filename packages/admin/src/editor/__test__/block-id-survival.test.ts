import { BLOCKS } from "@monti-cms/core/client";
import type { CmsNode } from "@monti-cms/core/document";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../extensions";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

/**
 * Block ids anchor code refs, issues and translation pairing, so the editor must keep the ids a stored document has: through the conversion to the editor and back,
 * and through edits. These documents are built by hand with explicit ids on every block, including the rows and cells of a table and the children of a container.
 */

const withId = (id: string, node: CmsNode): CmsNode => ({ ...node, id });
const para = (id: string, value: string): CmsNode =>
	withId(id, { type: "paragraph", content: [{ type: "text", text: value }] });

const tableDoc: StoredDocument = {
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [
		withId("tbl00001", {
			type: "table",
			content: [
				withId("row00001", {
					type: "tableRow",
					content: [
						withId("cel00001", { type: "tableCell", content: [{ type: "text", text: "a" }] }),
						withId("cel00002", { type: "tableCell", content: [{ type: "text", text: "b" }] }),
					],
				}),
				withId("row00002", {
					type: "tableRow",
					content: [
						withId("cel00003", { type: "tableCell", content: [{ type: "text", text: "c" }] }),
						withId("cel00004", { type: "tableCell", content: [{ type: "text", text: "d" }] }),
					],
				}),
			],
		}),
	],
};

const tabsDoc: StoredDocument = {
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [
		withId("tab00001", {
			type: "tabs",
			content: [
				withId("tbi00001", { type: "tab", attrs: { label: "One" }, content: [para("par00011", "first")] }),
				withId("tbi00002", { type: "tab", attrs: { label: "Two" }, content: [para("par00012", "second")] }),
			],
		}),
		withId("col00001", {
			type: "columns",
			content: [
				withId("cli00001", { type: "column", content: [para("par00021", "left")] }),
				withId("cli00002", { type: "column", content: [para("par00022", "right")] }),
			],
		}),
	],
};

/** Every id in a document, in document order. */
const idsOf = (nodes: readonly CmsNode[] | undefined): string[] =>
	(nodes ?? []).flatMap((node) => [...(node.id ? [node.id] : []), ...idsOf(node.content)]);

const roundTrip = (doc: StoredDocument) => tiptapToStored(storedToTiptap(doc));

describe("block ids through the editor", () => {
	it.each([
		["a table with rows and cells", tableDoc],
		["tabs and columns with their children", tabsDoc],
	])("%s keep their ids through storedToTiptap and tiptapToStored", (_, doc) => {
		expect(idsOf(roundTrip(doc).content)).toEqual(idsOf(doc.content));
	});

	it("keeps the ids of a table after its text is edited and a cell is typed into", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: storedToTiptap(tableDoc) });
		editor.commands.setTextSelection(4);
		editor.commands.insertContent("x");
		const saved = tiptapToStored(editor.getJSON());
		expect(idsOf(saved.content)).toEqual(
			expect.arrayContaining(idsOf(tableDoc.content).filter((id) => !id.startsWith("par"))),
		);
		expect(saved.content[0]?.id).toBe("tbl00001");
		editor.destroy();
	});

	// The reference blog config has tabs and columns; another site config may not install them.
	it.skipIf(!BLOCKS.some((block) => block.name === "tabs"))(
		"keeps the ids of tabs and columns after an edit inside them",
		() => {
			const editor = new Editor({ extensions: buildEditorExtensions(), content: storedToTiptap(tabsDoc) });
			editor.commands.setTextSelection(editor.state.doc.content.size - 3);
			editor.commands.insertContent("!");
			const saved = tiptapToStored(editor.getJSON());
			expect(idsOf(saved.content)).toEqual(
				expect.arrayContaining(["tab00001", "tbi00001", "tbi00002", "col00001", "cli00001", "cli00002"]),
			);
			editor.destroy();
		},
	);
});

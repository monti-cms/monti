import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCK_INSERT_ACTIONS, ADDED_NODE_BLOCKS, blockNodeName } from "../blocks/added";
import { buildEditorExtensions } from "../extensions";
import { buildBlockSlashCommands } from "../slash-command";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

/**
 * Editor flow of blocks added to the config (regression guard). Block names are not hardcoded; they are read from the current config.
 * Runs with both the reference blog setup and another site's config.
 */

/** Fills the empty paragraph inside a block with text (the state after a user types into an inserted block). */
const fillEmptyParagraphs = (node: JSONContent, inside = false): JSONContent => {
	if (inside && node.type === "paragraph" && !node.content?.length) {
		return { ...node, content: [{ type: "text", text: "Typed text" }] };
	}
	const isBlock = node.type !== "doc" && node.type !== "paragraph";
	return node.content
		? { ...node, content: node.content.map((child) => fillEmptyParagraphs(child, inside || isBlock)) }
		: node;
};

const insertable = ADDED_NODE_BLOCKS.filter((block) => block.editor.insertable && !block.parent);

describe("any site: added blocks in the editor", () => {
	it("the active config adds at least one insertable block", () => {
		expect(insertable.length).toBeGreaterThan(0);
	});

	it.each(
		insertable.map((block) => [block.name, block] as const),
	)("%s is in the slash menu under its own label", (_name, block) => {
		const command = buildBlockSlashCommands().find((item) => item.id === block.name);
		expect(command?.title).toBe(block.label);
	});

	it.each(
		insertable.map((block) => [block.name, block] as const),
	)("%s inserted from the slash menu saves as a stored document and reopens as the same node", (_name, block) => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p></p>" });
		ADDED_BLOCK_INSERT_ACTIONS[block.name]?.(editor, { from: 1, to: 1 });
		// A block that holds body text is saved with the typed text in place (a block that must have a body opens as a raw box when empty).
		const stored = tiptapToStored(fillEmptyParagraphs(editor.getJSON()));
		editor.destroy();
		const reopened = storedToTiptap(stored);
		expect(reopened.content?.some((node) => node.type === blockNodeName(block))).toBe(true);
		// Saving again changes nothing (ids of the children inside a block are the editor's, so the first save is compared with the second only by its shape).
		const again = tiptapToStored(reopened);
		expect(again.content.map((node) => node.type)).toEqual(stored.content.map((node) => node.type));
		expect(tiptapToStored(storedToTiptap(again))).toEqual(again);
	});
});

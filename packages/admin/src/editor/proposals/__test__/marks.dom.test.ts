import { buildEditorExtensions } from "@monti-cms/admin/editor";
import type { CmsNode } from "@monti-cms/core/document";
import { within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { docOf, tiptapOf } from "../../../test/mdx";
import { BLOCK_ID_ATTRIBUTE } from "../../block-ids";
import {
	type BlockProposal,
	blocksById,
	drawable,
	MARKER_ATTRIBUTE,
	proposalMarksKey,
	proposalMarksPlugin,
} from "../marks";
import { acceptInEditor } from "../use-proposal-marks";

const BODY = "I decided to rebuild the blog.\n\nThe list keeps the title.\n\nSettings stayed as they were.";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

/** An editor on `BODY`, with the marks plugin, and the proposals: the first paragraph reworded and the last one removed. */
const open = () => {
	const doc = docOf(BODY);
	editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf(BODY) });
	editor.registerPlugin(proposalMarksPlugin(() => undefined));
	const ids = [...blocksById(editor.state.doc).keys()];
	const stored = doc.content.map((block, index) => ({ ...block, id: ids[index] }) as CmsNode);
	const proposals: BlockProposal[] = [
		{
			id: "reword",
			blockId: ids[0] ?? "",
			block: stored[0] as CmsNode,
			nodes: docOf("I rebuilt my blog.").content.map((node) => ({ ...node, id: ids[0] })),
		},
		{ id: "remove", blockId: ids[2] ?? "", block: stored[2] as CmsNode, nodes: [] },
	];
	editor.view.dispatch(editor.state.tr.setMeta(proposalMarksKey, { proposals, current: "reword" }));
	return { editor, proposals };
};
const textOf = (current: Editor) => {
	const out: string[] = [];
	current.state.doc.forEach((node) => {
		out.push(node.textContent);
	});
	return out;
};

describe("proposals in the editor", () => {
	it("ASSIST-E1 draws the words that go and come without changing the document, and strikes a block that goes", () => {
		const { editor } = open();
		// The struck-through runs: in the reworded paragraph, and the whole paragraph that goes.
		const struck = (proposalMarksKey.getState(editor.state)?.decorations.find() ?? []).filter((decoration) =>
			String((decoration as unknown as { type: { attrs?: { class?: string } } }).type.attrs?.class ?? "").includes(
				"line-through",
			),
		);
		expect(struck.length).toBeGreaterThanOrEqual(2);
		expect(
			within(editor.view.dom)
				.getAllByRole("insertion")
				.map((node) => node.textContent),
		).toEqual(expect.arrayContaining(["rebuilt", "my"]));
		expect(textOf(editor)).toEqual([
			"I decided to rebuild the blog.",
			"The list keeps the title.",
			"Settings stayed as they were.",
		]);
	});

	it("ASSIST-E1 puts an accepted change in the document as an edit ⌘Z takes back, and removes a block whose proposal removes it", () => {
		const { editor, proposals } = open();
		const placed = acceptInEditor(editor, testSite, { ...(proposals[0] as BlockProposal), request: "" });
		acceptInEditor(editor, testSite, { ...(proposals[1] as BlockProposal), request: "" });
		expect(textOf(editor)).toEqual(["I rebuilt my blog.", "The list keeps the title."]);
		expect(placed).toEqual([proposals[0]?.blockId]);
		expect(editor.state.doc.firstChild?.attrs[BLOCK_ID_ATTRIBUTE]).toBe(proposals[0]?.blockId);
		editor.commands.undo();
		editor.commands.undo();
		expect(textOf(editor)).toEqual([
			"I decided to rebuild the blog.",
			"The list keeps the title.",
			"Settings stayed as they were.",
		]);
	});

	it("ASSIST-E1 stops drawing a proposal whose block a person edited, and leaves the others", () => {
		const { editor, proposals } = open();
		expect(drawable(editor.state.doc, proposals).map((proposal) => proposal.id)).toEqual(["reword", "remove"]);
		editor.commands.insertContentAt(3, "really ");
		expect(drawable(editor.state.doc, proposals).map((proposal) => proposal.id)).toEqual(["remove"]);
	});

	it("ASSIST-E3 leaves a place for the request marker in the margin of a block whose card has requests, and none for the others", () => {
		const { editor, proposals } = open();
		const withRequests = proposals.map((proposal) =>
			proposal.id === "reword" ? { ...proposal, requests: 1 } : proposal,
		);
		editor.view.dispatch(editor.state.tr.setMeta(proposalMarksKey, { proposals: withRequests, current: "reword" }));
		const places = (proposalMarksKey.getState(editor.state)?.decorations.find() ?? []).filter(
			(decoration) => (decoration.spec as { key?: string }).key?.startsWith("marker:") === true,
		);
		expect(places.map((decoration) => (decoration.spec as { key?: string }).key)).toEqual(["marker:reword"]);
		expect(MARKER_ATTRIBUTE).toBe("data-proposal-marker");
	});
});

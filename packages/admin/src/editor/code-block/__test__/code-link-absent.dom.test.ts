import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { tiptapOf } from "../../../test/mdx";
import { codeAnchorRef } from "../../added-marks";
import { buildEditorExtensions } from "../../extensions";
import { codeEffectsKey, pickLines } from "../effects-plugin";
import { commitLink, startLinkFromText } from "../link-commands";

const ANCHOR_REF = codeAnchorRef(testSite);

/**
 * The body side of body-to-code linking is a text decoration pointing at code lines (attribute `codeAnchor`, e.g. the code link of the blocks extension). The core does not
 * know its name and finds it in the block definitions. As with other site configs, if no such decoration exists, linking changes nothing.
 */
describe("body decoration for body-to-code linking", () => {
	it("finds the decoration pointing at code lines in the block definitions (`codeAnchor`)", () => {
		const anchorBlock = testSite.ADDED_MARK_BLOCKS.find((block) =>
			Object.values(block.attributes).some((attribute) => attribute.codeAnchor),
		);
		expect(ANCHOR_REF?.mark ?? null).toBe(
			anchorBlock ? `cms${anchorBlock.name.replace(/(^|-)([a-z0-9])/g, (_, _d, c: string) => c.toUpperCase())}` : null,
		);
	});

	it.runIf(ANCHOR_REF === null)("if there is no such decoration, linking does not change the document", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(testSite),
			content: tiptapOf("이 함수가 값을 돌려준다.\n\n```ts\nconst a = 1;\n```\n"),
		});
		startLinkFromText(editor.view, 3, 6);
		pickLines(editor.view, editor.state.doc.child(0).nodeSize, 0, 1);
		expect(commitLink(testSite, editor.view)).toBe(false);
		const marks: string[] = [];
		editor.state.doc.descendants((node) => {
			marks.push(...node.marks.map((mark) => mark.type.name));
			return true;
		});
		expect(marks).toEqual([]);
		expect(editor.state.doc.child(1).attrs.lineEffects).toEqual([]);
		expect(codeEffectsKey.getState(editor.state)?.linking).toEqual({ kind: "text", from: 3, to: 6 });
		editor.destroy();
	});
});

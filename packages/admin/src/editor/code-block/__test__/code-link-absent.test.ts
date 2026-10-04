import { ADDED_MARK_BLOCKS } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { CODE_ANCHOR_REF } from "../../added-marks";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap } from "../../tiptap-content";
import { codeEffectsKey, pickLines } from "../effects-plugin";
import { commitLink, startLinkFromText } from "../link-commands";

/**
 * The body side of body-to-code linking is a text decoration pointing at code lines (attribute `codeAnchor`, e.g. the code link of the blocks extension). The core does not
 * know its name and finds it in the block definitions. As with other site configs, if no such decoration exists, linking changes nothing.
 */
describe("body decoration for body-to-code linking", () => {
	it("finds the decoration pointing at code lines in the block definitions (`codeAnchor`)", () => {
		const anchorBlock = ADDED_MARK_BLOCKS.find((block) =>
			Object.values(block.attributes).some((attribute) => attribute.codeAnchor),
		);
		expect(CODE_ANCHOR_REF?.mark ?? null).toBe(
			anchorBlock ? `cms${anchorBlock.name.replace(/(^|-)([a-z0-9])/g, (_, _d, c: string) => c.toUpperCase())}` : null,
		);
	});

	it.runIf(CODE_ANCHOR_REF === null)("if there is no such decoration, linking does not change the document", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: mdxToTiptap("이 함수가 값을 돌려준다.\n\n```ts\nconst a = 1;\n```\n"),
		});
		startLinkFromText(editor.view, 3, 6);
		pickLines(editor.view, editor.state.doc.child(0).nodeSize, 0, 1);
		expect(commitLink(editor.view)).toBe(false);
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

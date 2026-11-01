import { type BlockDefinition, type CmsConfig, defineBlock } from "@monti-cms/core";
import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { anchorIdsOf, codeNode, storedDoc, text, withoutIds } from "../../../test/stored-doc";
import { buildEditorExtensions } from "../../extensions";
import { storedToTiptap, tiptapToStored } from "../../tiptap-content";
import { codeEffectsKey, pickLines } from "../effects-plugin";
import { cancelLink, commitLink, findAnchor, startLinkFromLines, startLinkFromText, unlinkRef } from "../link-commands";

/**
 * The body side of the link is a text decoration whose attribute points at a code line (`codeAnchor`, like the blocks extension's code link). It is
 * defined here, and stands in for any such decoration the site has, so the test runs on any site config.
 */
const lineRef = defineBlock({
	name: "test-line-ref",
	label: "Line link",
	syntax: { kind: "text", directive: "test-line-ref" },
	component: "TestLineRef",
	attributes: { to: { type: "string", label: "Line", required: true, codeAnchor: true } },
	editor: { view: "mark" },
});
const pointsAtCode = (block: BlockDefinition) =>
	Object.values(block.attributes ?? {}).some((attribute) => attribute.codeAnchor === true);
const site = createSite({
	...testConfig,
	blocks: [...(testConfig.blocks ?? []).filter((block) => !pointsAtCode(block)), lineRef],
} as CmsConfig);

/** A text node linked to the code line labelled `to`. */
const codeLink = (value: string, to: string): CmsNode => text(value, [{ type: lineRef.name, attrs: { to } }]);
/** The targets (`to`) of the code links of a document, in document order. */
const codeLinkTargetsOf = (doc: StoredDocument): string[] => {
	const targets: string[] = [];
	const walk = (nodes: readonly CmsNode[]) => {
		for (const node of nodes) {
			for (const mark of node.marks ?? [])
				if (mark.type === lineRef.name && typeof mark.attrs?.to === "string") targets.push(mark.attrs.to);
			if (node.content) walk(node.content);
		}
	};
	walk(doc.content);
	return targets;
};

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const CODE = "function add(a, b) {\n  return a + b;\n}";
const SOURCE = storedDoc({ type: "paragraph", content: [text("이 함수가 값을 돌려준다.")] }, codeNode(CODE));

const mount = (doc = SOURCE) => {
	editor = new Editor({ extensions: buildEditorExtensions(site), content: storedToTiptap(site, doc) });
	return editor;
};

/** Document range of "함수가". */
const wordRange = (instance: Editor, word = "함수가") => {
	const from = 1 + instance.state.doc.child(0).textContent.indexOf(word);
	return { from, to: from + word.length };
};
const codePos = (instance: Editor) => instance.state.doc.child(0).nodeSize;
const save = (instance: Editor) => tiptapToStored(site, instance.getJSON());

describe("linking body text to code (editor)", () => {
	it("EDIT-C4 pick body text first, then a line by its number, then link: the body link and line label are created together", () => {
		const instance = mount();
		const { from, to } = wordRange(instance);
		startLinkFromText(instance.view, from, to);
		expect(codeEffectsKey.getState(instance.state)?.linking).toEqual({ kind: "text", from, to });

		pickLines(instance.view, codePos(instance), 0, 2);
		expect(commitLink(site, instance.view)).toBe(true);

		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();
		expect(withoutIds(save(instance))).toEqual(
			withoutIds(
				storedDoc(
					{ type: "paragraph", content: [text("이 "), codeLink("함수가", "c1"), text(" 값을 돌려준다.")] },
					codeNode(CODE, { annotations: { lines: [{ name: "anchor", start: 0, end: 2, attrs: { id: "c1" } }] } }),
				),
			),
		);
	});

	it("EDIT-C4 pick a code line first, then body text, then link. For the same line, the label is reused", () => {
		const instance = mount();
		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		const first = wordRange(instance, "함수가");
		instance.commands.setTextSelection(first);
		expect(commitLink(site, instance.view)).toBe(true);

		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		instance.commands.setTextSelection(wordRange(instance, "값을"));
		commitLink(site, instance.view);

		const output = save(instance);
		const linked = (output.content[0]?.content ?? []).filter((node) => node.marks?.length).map((node) => node.text);
		expect(linked).toEqual(["함수가", "값을"]);
		expect(codeLinkTargetsOf(output)).toEqual(["c1", "c1"]);
		expect(anchorIdsOf(output)).toEqual(["c1"]);
	});

	it("EDIT-C4 does not link if there is no body text or no line is picked, and Esc or cancel backs out", () => {
		const instance = mount();
		startLinkFromText(instance.view, ...(Object.values(wordRange(instance)) as [number, number]));
		expect(commitLink(site, instance.view)).toBe(false);
		cancelLink(instance.view);
		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();

		startLinkFromLines(instance.view, codePos(instance), 0, 1);
		instance.view.someProp("handleKeyDown", (handler) =>
			handler(instance.view, new KeyboardEvent("keydown", { key: "Escape" })),
		);
		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();
	});

	it("EDIT-C4 unlinking also removes a line label that nothing points to anymore", () => {
		const instance = mount();
		const range = wordRange(instance);
		startLinkFromText(instance.view, range.from, range.to);
		pickLines(instance.view, codePos(instance), 0, 1);
		commitLink(site, instance.view);
		expect(findAnchor(instance.state.doc, "c1")).toMatchObject({ start: 0, end: 1 });

		unlinkRef(site, instance.view, range.from, range.to);
		expect(findAnchor(instance.state.doc, "c1")).toBeNull();
		expect(withoutIds(save(instance))).toEqual(withoutIds(SOURCE));
	});
});

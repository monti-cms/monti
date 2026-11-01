import { type BlockDefinition, type CmsConfig, defineBlock } from "@monti-cms/core";
import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { anchorIdsOf, codeNode, storedDoc, text } from "../../../test/stored-doc";
import { duplicateBlock } from "../../block-commands";
import { buildEditorExtensions } from "../../extensions";
import { storedToTiptap, tiptapToStored } from "../../tiptap-content";
import { findAnchor } from "../link-commands";

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

const SOURCE = storedDoc(
	{ type: "paragraph", content: [text("Read "), codeLink("the sum", "c1"), text(".")] },
	codeNode("const a = 1;\nconst b = a + 1;", {
		annotations: { lines: [{ name: "anchor", start: 1, end: 2, attrs: { id: "c1" } }] },
	}),
);

const mount = (doc = SOURCE) => {
	editor = new Editor({ extensions: buildEditorExtensions(site), content: storedToTiptap(site, doc) });
	return editor;
};

const save = (instance: Editor) => tiptapToStored(site, instance.getJSON());

/** Position of the n-th code block. */
const codeBlockAt = (instance: Editor, nth = 0) => {
	const found: number[] = [];
	instance.state.doc.descendants((node, pos) => {
		if (node.type.name === "codeBlock") found.push(pos);
		return node.type.name !== "codeBlock";
	});
	return found[nth] as number;
};

describe("line labels stay unique in the editor", () => {
	it("EDIT-C4 a duplicated code block does not take the label: links keep pointing to the original lines", () => {
		const instance = mount();
		duplicateBlock(instance, codeBlockAt(instance));
		const saved = save(instance);
		expect(saved.content.filter((node) => JSON.stringify(node).includes("const a = 1;"))).toHaveLength(2);
		expect(anchorIdsOf(saved)).toEqual(["c1"]);
		expect(findAnchor(instance.state.doc, "c1")?.blockPos).toBe(codeBlockAt(instance, 0));
	});

	it("EDIT-C4 pasting text and code that link to each other renames the pasted label and its links together", () => {
		const instance = mount();
		const copied = instance.state.doc.slice(0, instance.state.doc.content.size);
		instance.view.dispatch(
			instance.state.tr.replace(
				instance.state.doc.content.size,
				instance.state.doc.content.size,
				new Slice(copied.content, 0, 0),
			),
		);
		const saved = save(instance);
		expect(anchorIdsOf(saved)).toEqual(["c1", "c2"]);
		expect(codeLinkTargetsOf(saved)).toEqual(["c1", "c2"]);
	});

	it("EDIT-C4 pasting only a code block with a label already in the document drops the pasted label", () => {
		const instance = mount();
		const block = instance.state.doc.nodeAt(codeBlockAt(instance));
		if (!block) throw new Error("no code block");
		// A pasted block carries no block id: the HTML it comes from has none.
		const pasted = block.type.create({ ...block.attrs, blockId: null }, block.content, block.marks);
		instance.view.dispatch(instance.state.tr.insert(0, pasted));
		const saved = save(instance);
		// The pasted copy is first in the document, but the block that held the label keeps it.
		expect(anchorIdsOf(saved)).toEqual(["c1"]);
		expect(findAnchor(instance.state.doc, "c1")?.blockPos).toBe(codeBlockAt(instance, 1));
	});
});

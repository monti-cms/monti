import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";
import { duplicateBlock } from "../../block-commands";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../tiptap-content";
import { findAnchor } from "../link-commands";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const SOURCE = [
	'Read <CodeRef to="c1">the sum</CodeRef>.',
	"",
	"```ts",
	'// @line anchor {1-1} id="c1"',
	"const a = 1;",
	"const b = a + 1;",
	"```",
].join("\n");

const mount = (source = SOURCE) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(source) });
	return editor;
};

const save = (instance: Editor) => tiptapToMdx(instance.getJSON()).trimEnd();

/** Position of the n-th code block. */
const codeBlockAt = (instance: Editor, nth = 0) => {
	const found: number[] = [];
	instance.state.doc.descendants((node, pos) => {
		if (node.type.name === "codeBlock") found.push(pos);
		return node.type.name !== "codeBlock";
	});
	return found[nth] as number;
};

const labelsOf = (mdx: string) => [...mdx.matchAll(/@line anchor \{[^}]*\} id="([^"]+)"/g)].map((match) => match[1]);
const linksOf = (mdx: string) => [...mdx.matchAll(/<CodeRef to="([^"]+)">/g)].map((match) => match[1]);

describe("line labels stay unique in the editor", () => {
	it("a duplicated code block does not take the label: links keep pointing to the original lines", () => {
		const instance = mount();
		duplicateBlock(instance, codeBlockAt(instance));
		const mdx = save(instance);
		expect(mdx.match(/const a = 1;/g)).toHaveLength(2);
		expect(labelsOf(mdx)).toEqual(["c1"]);
		expect(findAnchor(instance.state.doc, "c1")?.blockPos).toBe(codeBlockAt(instance, 0));
	});

	it("pasting text and code that link to each other renames the pasted label and its links together", () => {
		const instance = mount();
		const copied = instance.state.doc.slice(0, instance.state.doc.content.size);
		instance.view.dispatch(
			instance.state.tr.replace(
				instance.state.doc.content.size,
				instance.state.doc.content.size,
				new Slice(copied.content, 0, 0),
			),
		);
		const mdx = save(instance);
		expect(labelsOf(mdx)).toEqual(["c1", "c2"]);
		expect(linksOf(mdx)).toEqual(["c1", "c2"]);
	});

	it("pasting only a code block with a label already in the document drops the pasted label", () => {
		const instance = mount();
		const block = instance.state.doc.nodeAt(codeBlockAt(instance));
		if (!block) throw new Error("no code block");
		instance.view.dispatch(instance.state.tr.insert(0, block));
		const mdx = save(instance);
		// The pasted copy is first in the document, but the block that held the label keeps it.
		expect(labelsOf(mdx)).toEqual(["c1"]);
		expect(findAnchor(instance.state.doc, "c1")?.blockPos).toBe(codeBlockAt(instance, 1));
	});

	it("undoing a duplicate removes the copy in one step", () => {
		const instance = mount();
		const before = save(instance);
		duplicateBlock(instance, codeBlockAt(instance));
		instance.commands.undo();
		expect(save(instance)).toBe(before);
	});
});

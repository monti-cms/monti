import { assignBlockIds, type CmsNode, forEachBlock, isBlockId, type StoredDocument } from "@monti-cms/core/document";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { docOf, tiptapOf } from "../../test/mdx";
import { duplicateBlock } from "../block-commands";
import { BLOCK_ID_ATTRIBUTE, findBlock } from "../block-ids";
import { buildEditorExtensions } from "../extensions";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

const BODY = [
	"# Title",
	"",
	"First paragraph",
	"",
	"- one",
	"- two",
	"",
	"> Quoted",
	"",
	"```ts",
	"const a = 1;",
	"```",
	"",
	"Last paragraph",
	"",
].join("\n");

const stored = (mdx: string): StoredDocument => docOf(mdx);

/** Block ids of a stored document in block order, with each block's kind and text. */
const blocksOf = (doc: StoredDocument | null) => {
	const out: { type: string; text: string; id: string | undefined }[] = [];
	const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");
	if (doc) forEachBlock(doc.content, (node) => out.push({ type: node.type, text: textOf(node), id: node.id }));
	return out;
};

const idOf = (doc: StoredDocument | null, text: string, type = "paragraph") =>
	blocksOf(doc).find((block) => block.type === type && block.text === text)?.id;

const editors: Editor[] = [];
const open = (doc: StoredDocument) => {
	const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: storedToTiptap(testSite, doc) });
	editors.push(editor);
	return editor;
};
afterEach(() => {
	for (const editor of editors.splice(0)) editor.destroy();
});

const saved = (editor: Editor) => tiptapToStored(testSite, editor.getJSON());

/** Puts the cursor at the end of the paragraph with this text. */
const cursorAtEndOf = (editor: Editor, text: string) => {
	let at = -1;
	editor.state.doc.descendants((node, pos) => {
		if (at < 0 && node.type.name === "paragraph" && node.textContent === text) at = pos + node.nodeSize - 1;
	});
	editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)));
};

describe("block ids in the editor", () => {
	it("load with a stored document and come back unchanged", () => {
		const doc = stored(BODY);
		const editor = open(doc);
		const back = saved(editor);
		for (const block of blocksOf(doc).filter(({ type }) => ["heading", "paragraph", "codeBlock"].includes(type))) {
			expect(idOf(back, block.text, block.type), block.text).toBe(block.id);
		}
	});

	it("do not change while typing", () => {
		const doc = stored(BODY);
		const editor = open(doc);
		cursorAtEndOf(editor, "First paragraph");
		editor.commands.insertContent(", edited");
		expect(idOf(saved(editor), "First paragraph, edited")).toBe(idOf(doc, "First paragraph"));
	});

	it("stay on the first part when a paragraph is split, and the new part gets its own", () => {
		const doc = stored(BODY);
		const editor = open(doc);
		cursorAtEndOf(editor, "First paragraph");
		editor.commands.splitBlock();
		editor.commands.insertContent("New paragraph");
		const after = saved(editor);
		expect(idOf(after, "First paragraph")).toBe(idOf(doc, "First paragraph"));
		const added = idOf(after, "New paragraph");
		expect(isBlockId(added)).toBe(true);
		expect(blocksOf(doc).map((block) => block.id)).not.toContain(added);
	});

	it("give a duplicated block a new id", () => {
		const doc = stored("Only paragraph\n");
		const editor = open(doc);
		const pos = findBlock(editor.state.doc, idOf(doc, "Only paragraph") as string);
		expect(pos).toEqual(expect.any(Number));
		duplicateBlock(editor, pos as number);
		const ids = blocksOf(saved(editor))
			.filter((block) => block.text === "Only paragraph")
			.map((block) => block.id);
		expect(ids).toHaveLength(2);
		expect(ids[0]).toBe(idOf(doc, "Only paragraph"));
		expect(isBlockId(ids[1])).toBe(true);
		expect(ids[1]).not.toBe(ids[0]);
	});

	it("are given to every block of a body loaded from MDX, all different", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf(BODY) });
		editors.push(editor);
		editor.commands.insertContent("x");
		const ids: unknown[] = [];
		editor.state.doc.descendants((node) => {
			if (node.isBlock) ids.push(node.attrs[BLOCK_ID_ATTRIBUTE]);
		});
		expect(ids.every(isBlockId)).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("are paired with the previous document when MDX comes back from source mode", () => {
		const doc = stored(BODY);
		const content = tiptapOf(BODY.replace("Last paragraph", "Last paragraph, rewritten in source"), doc);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content });
		editors.push(editor);
		const after = saved(editor);
		expect(idOf(after, "Last paragraph, rewritten in source")).toBe(idOf(doc, "Last paragraph"));
		expect(idOf(after, "First paragraph")).toBe(idOf(doc, "First paragraph"));
	});

	it("are not on inline nodes", () => {
		const editor = open(stored("Text with a note[^1].\n\n[^1]: The note\n"));
		editor.state.doc.descendants((node) => {
			if (node.isInline) expect(node.attrs).not.toHaveProperty(BLOCK_ID_ATTRIBUTE);
		});
	});
});

describe("source links in the editor", () => {
	/** A translation of `mdx` as it is stored: every block, nested ones too, linked to the source block it was made from. */
	const translationOf = (mdx: string) => {
		const source = stored(mdx);
		const link = (nodes: readonly CmsNode[]): CmsNode[] =>
			nodes.map(({ id, content, ...node }) => {
				if (node.text !== undefined) return { ...node, ...(content ? { content } : {}) };
				return { ...node, ...(content ? { content: link(content) } : {}), sourceId: id as string };
			});
		const doc: StoredDocument = { ...source, content: assignBlockIds(link(source.content)) };
		return { source, doc };
	};
	const linkOf = (doc: StoredDocument | null, text: string, type = "paragraph") => {
		let found: string | undefined;
		const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");
		if (doc)
			forEachBlock(doc.content, (node) => {
				if (found === undefined && node.type === type && textOf(node) === text) found = node.sourceId ?? "none";
			});
		return found;
	};

	it("load with a stored document and come back unchanged, nested blocks included", () => {
		const { source, doc } = translationOf(BODY);
		const back = saved(open(doc));
		expect(linkOf(back, "First paragraph")).toBe(idOf(source, "First paragraph"));
		expect(linkOf(back, "Quoted")).toBe(idOf(source, "Quoted"));
		expect(linkOf(back, "one")).toBe(idOf(source, "one"));
	});

	it("come back unchanged on the items of a task list", () => {
		const { source, doc } = translationOf("- [ ] Open task\n- [x] Done task\n");
		const back = saved(open(doc));
		expect(linkOf(back, "Open task", "listItem")).toBe(idOf(source, "Open task", "listItem"));
		expect(linkOf(back, "Done task", "listItem")).toBe(idOf(source, "Done task", "listItem"));
	});

	it("stay on the first part when a paragraph is split: the new part has none", () => {
		const { source, doc } = translationOf(BODY);
		const editor = open(doc);
		cursorAtEndOf(editor, "First paragraph");
		editor.commands.splitBlock();
		editor.commands.insertContent("New paragraph");
		const after = saved(editor);
		expect(linkOf(after, "First paragraph")).toBe(idOf(source, "First paragraph"));
		expect(linkOf(after, "New paragraph")).toBe("none");
	});

	it("are not given to a duplicated block", () => {
		const { source, doc } = translationOf("Only paragraph\n");
		const editor = open(doc);
		duplicateBlock(editor, findBlock(editor.state.doc, idOf(doc, "Only paragraph") as string) as number);
		const links: (string | undefined)[] = [];
		forEachBlock(saved(editor).content, (node) => links.push(node.sourceId));
		expect(links).toEqual([idOf(source, "Only paragraph"), undefined]);
	});
});

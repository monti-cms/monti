import type { CmsNode } from "@monti-cms/core/document";
import { renderHook, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { buildEditorExtensions } from "../../../editor/extensions";
import { storedToTiptap } from "../../../editor/tiptap-content";
import { para } from "../../../test/stored-doc";
import {
	ACTIVE_BLOCK_CLASS,
	blockPathAt,
	followCollapsed,
	type PairBox,
	pairSyncBlocks,
	SOURCE_COLLAPSED_ATTRIBUTE,
	type SyncBlock,
	sourceLineAt,
	syncBlocksOf,
	useSourceSync,
} from "../source-sync";

// Ids are 8 characters of base36; a translation block names its source block by `sourceId`.
const id = (name: string) => name.padEnd(8, "0");
const block = (node: CmsNode, name?: string, link?: string): CmsNode => ({
	...node,
	...(name ? { id: id(name) } : {}),
	...(link ? { sourceId: id(link) } : {}),
});
const heading = (value: string): CmsNode => ({
	type: "heading",
	attrs: { level: 2 },
	content: [{ type: "text", text: value }],
});
const callout = (...content: CmsNode[]): CmsNode => ({ type: "callout", attrs: { type: "note" }, content });
const quote = (...content: CmsNode[]): CmsNode => ({ type: "blockquote", content });
const list = (...items: string[]): CmsNode => ({
	type: "bulletList",
	content: items.map((item) => ({ type: "listItem", content: [para(item)] })),
});

const editors: Editor[] = [];
afterEach(() => {
	for (const editor of editors.splice(0)) editor.destroy();
	document.body.innerHTML = "";
});

const editorOf = (content: CmsNode[], element?: HTMLElement) => {
	const editor = new Editor({
		...(element ? { element } : {}),
		extensions: buildEditorExtensions(testSite),
		content: storedToTiptap(testSite, { type: "doc", version: 2, content } as never),
	});
	editors.push(editor);
	return editor;
};
const blocksOf = (...content: CmsNode[]) => syncBlocksOf(editorOf(content).state.doc);

/** For each translation block (top level, then inside boxes), the id of its source partner or `null`. */
const partnersOf = (translation: readonly SyncBlock[], source: readonly SyncBlock[]) => {
	const pairs = pairSyncBlocks(translation, source);
	const walk = (blocks: readonly SyncBlock[]): unknown[] =>
		blocks.map((item) => {
			const partner = pairs.get(item)?.id ?? null;
			return item.children ? { partner, inside: walk(item.children) } : partner;
		});
	return walk(translation);
};

describe("pairing translation blocks with source blocks", () => {
	it("TRANS-S3 pairs by the stored link before kind", () => {
		const source = blocksOf(block(heading("A"), "a"), block(para("B"), "b"), block(para("C"), "c"));
		// By kind alone the paragraph would take B, the first paragraph of the source.
		const translation = blocksOf(block(heading("A'"), "t1", "a"), block(para("C'"), "t2", "c"));
		expect(partnersOf(translation, source)).toEqual([id("a"), id("c")]);
	});

	it("TRANS-S3 pairs blocks without a link by kind between the linked ones", () => {
		const source = blocksOf(block(heading("A"), "a"), block(para("B"), "b"), block(para("C"), "c"));
		const translation = blocksOf(
			block(heading("A'"), "t1", "a"),
			block(para("B'"), "t2"),
			block(para("C'"), "t3", "c"),
		);
		expect(partnersOf(translation, source)).toEqual([id("a"), id("b"), id("c")]);
	});

	it("TRANS-S3 leaves a block added between two linked blocks unpaired", () => {
		const source = blocksOf(block(para("A"), "a"), block(para("B"), "b"));
		// The second part of a split paragraph, and a new paragraph, carry no link.
		const translation = blocksOf(
			block(para("A'"), "t1", "a"),
			block(para("split"), "t2"),
			block(para("new"), "t3"),
			block(para("B'"), "t4", "b"),
		);
		expect(partnersOf(translation, source)).toEqual([id("a"), null, null, id("b")]);
	});

	it("TRANS-S3 leaves a source block unpaired once its translation block is deleted", () => {
		const source = blocksOf(block(para("A"), "a"), block(para("B"), "b"), block(para("C"), "c"));
		const translation = blocksOf(block(para("A'"), "t1", "a"), block(para("C'"), "t3", "c"));
		const pairs = pairSyncBlocks(translation, source);
		expect([...pairs.values()].map((partner) => partner.id)).not.toContain(id("b"));
	});

	it("TRANS-S3 falls back to kind when a link no longer matches a source block", () => {
		const source = blocksOf(block(heading("A"), "a"), block(para("B"), "b2"));
		const translation = blocksOf(block(heading("A'"), "t1", "a"), block(para("B'"), "t2", "b"));
		expect(partnersOf(translation, source)).toEqual([id("a"), id("b2")]);
	});

	it("TRANS-S3 pairs the blocks inside paired boxes, by link and then by kind", () => {
		const source = blocksOf(
			block(callout(block(para("X"), "x"), block(heading("Y"), "y"), block(para("Z"), "z")), "k"),
			block(para("after"), "p"),
		);
		const translation = blocksOf(
			block(callout(block(para("X'"), "t2"), block(heading("Y'"), "t3", "y"), block(para("Z'"), "t4", "z")), "t1", "k"),
			block(para("after'"), "t5", "p"),
		);
		expect(partnersOf(translation, source)).toEqual([
			{ partner: id("k"), inside: [id("x"), id("y"), id("z")] },
			id("p"),
		]);
	});

	it("TRANS-S3 treats lists and tables as one block, and boxes whose body is blocks as boxes", () => {
		const [first, second] = blocksOf(list("one", "two"), callout(para("inside")));
		expect(first?.children).toBeNull();
		expect(second?.children?.map((child) => child.kind)).toEqual(["paragraph"]);
	});
});

describe("the block the cursor is in", () => {
	it("TRANS-S3 is the innermost block holding the position, inside boxes", () => {
		const blocks = blocksOf(para("before"), callout(para("first"), para("second")));
		const box = blocks[1] as SyncBlock;
		const inner = box.children?.[1] as SyncBlock;
		expect(blockPathAt(blocks, inner.pos + 2)).toEqual([box, inner]);
		expect(blockPathAt(blocks, (blocks[0] as SyncBlock).pos + 1)).toEqual([blocks[0]]);
	});

	it("TRANS-S3 stops at a list: a list is anchored as a whole", () => {
		const blocks = blocksOf(list("one", "two"));
		expect(blockPathAt(blocks, (blocks[0] as SyncBlock).pos + 6)).toEqual([blocks[0]]);
	});
});

describe("following the translation's middle line", () => {
	const pair = (translation: [number, number], source: [number, number], inner?: PairBox[]): PairBox => ({
		translation: { top: translation[0], bottom: translation[1] },
		source: { top: source[0], bottom: source[1] },
		...(inner ? { inner: () => inner } : {}),
	});

	it("TRANS-S3 puts the same share of the paired source block on the line", () => {
		const pairs = [pair([100, 200], [300, 350]), pair([200, 400], [350, 450])];
		// The line is halfway down the second translation block: halfway down its source block.
		expect(sourceLineAt(pairs, 300)).toBe(400);
	});

	it("TRANS-S3 keeps the distance to the nearest block above the first and below the last", () => {
		const pairs = [pair([100, 200], [300, 350]), pair([200, 400], [350, 450])];
		expect(sourceLineAt(pairs, 70)).toBe(270);
		expect(sourceLineAt(pairs, 500)).toBe(550);
	});

	it("TRANS-S3 goes inside a box to the inner pair holding the line", () => {
		const pairs = [pair([100, 500], [100, 300], [pair([150, 250], [120, 160]), pair([250, 450], [160, 280])])];
		expect(sourceLineAt(pairs, 350)).toBe(220);
	});

	it("TRANS-S3 is null with no pairs", () => {
		expect(sourceLineAt([], 100)).toBeNull();
	});
});

describe("collapsible boxes in the source", () => {
	const view = (collapsed: boolean, nested?: HTMLElement) => {
		const root = document.createElement("div");
		root.className = "react-renderer";
		const body = document.createElement("div");
		body.setAttribute("data-node-view-content", "");
		if (collapsed) body.setAttribute("data-monti-collapsed", "");
		if (nested) body.append(nested);
		root.append(body);
		return { root, body };
	};

	it("TRANS-S3 collapse and open as the paired translation box does", () => {
		const source = view(false);
		followCollapsed(view(true).root, source.root);
		expect(source.body.hasAttribute(SOURCE_COLLAPSED_ATTRIBUTE)).toBe(true);
		followCollapsed(view(false).root, source.root);
		expect(source.body.hasAttribute(SOURCE_COLLAPSED_ATTRIBUTE)).toBe(false);
	});

	it("TRANS-S3 follow only their own body, not a box nested inside", () => {
		const nested = view(false);
		const source = view(false, nested.root);
		followCollapsed(view(true, view(false).root).root, source.root);
		expect(source.body.hasAttribute(SOURCE_COLLAPSED_ATTRIBUTE)).toBe(true);
		expect(nested.body.hasAttribute(SOURCE_COLLAPSED_ATTRIBUTE)).toBe(false);
	});
});

describe("useSourceSync", () => {
	const mount = (translationContent: CmsNode[], sourceContent: CmsNode[]) => {
		const scroller = document.createElement("div");
		const pane = document.createElement("aside");
		document.body.append(pane, scroller);
		const translation = editorOf(translationContent, scroller);
		const source = editorOf(sourceContent, pane);
		renderHook(() =>
			useSourceSync({
				enabled: true,
				syncScroll: true,
				editor: scroller,
				pane,
			}),
		);
		const marked = (editor: Editor) =>
			Array.from(editor.view.dom.querySelectorAll(`.${ACTIVE_BLOCK_CLASS}`)).map((element) => element.textContent);
		const putCursorIn = (text: string) => {
			let at = 0;
			translation.state.doc.descendants((node, pos) => {
				if (at === 0 && node.isText && node.text === text) at = pos + 1;
			});
			translation.commands.setTextSelection(at);
			const selection = document.getSelection();
			selection?.collapse(translation.view.domAtPos(at).node, 0);
			document.dispatchEvent(new Event("selectionchange"));
		};
		return { translation, source, marked, putCursorIn };
	};

	it("TRANS-S3 marks the block under the cursor and its source block, by link", async () => {
		const { translation, source, marked, putCursorIn } = mount(
			[block(para("둘째 번역"), "t1", "b"), block(para("첫째 번역"), "t2", "a")],
			[block(para("첫째"), "a"), block(para("둘째"), "b")],
		);
		putCursorIn("첫째 번역");
		await waitFor(() => expect(marked(source)).toEqual(["첫째"]));
		expect(marked(translation)).toEqual(["첫째 번역"]);
		putCursorIn("둘째 번역");
		await waitFor(() => expect(marked(source)).toEqual(["둘째"]));
	});

	it("TRANS-S3 marks the innermost paired block inside a box", async () => {
		const { source, marked, putCursorIn } = mount(
			[block(quote(block(para("밖 번역"), "t2", "w"), block(para("안 번역"), "t3", "x")), "t1", "k")],
			[block(quote(block(para("밖"), "w"), block(para("안"), "x")), "k")],
		);
		putCursorIn("안 번역");
		await waitFor(() => expect(marked(source)).toEqual(["안"]));
	});

	it("TRANS-S3 keeps the mark on the first part of a split block and leaves the source where it is", async () => {
		const { translation, source, marked, putCursorIn } = mount(
			[block(para("첫째 번역"), "t1", "a"), block(para("둘째 번역"), "t2", "b")],
			[block(para("첫째"), "a"), block(para("둘째"), "b")],
		);
		putCursorIn("첫째 번역");
		await waitFor(() => expect(marked(translation)).toEqual(["첫째 번역"]));
		// Split the first paragraph with the cursor left in its first part.
		const at = translation.state.selection.from;
		translation.commands.splitBlock();
		translation.commands.setTextSelection(at);
		document.dispatchEvent(new Event("selectionchange"));
		await waitFor(() => expect(marked(translation)).toEqual(["첫"]));
		expect(marked(source)).toEqual(["첫째"]);
	});

	it("TRANS-S3 marks nothing for a block with no pair", async () => {
		const { translation, source, marked, putCursorIn } = mount(
			[block(para("번역"), "t1", "a"), block(para("새 문단"), "t2")],
			[block(para("원문"), "a")],
		);
		putCursorIn("번역");
		await waitFor(() => expect(marked(source)).toEqual(["원문"]));
		putCursorIn("새 문단");
		await waitFor(() => expect(marked(translation)).toEqual([]));
		expect(marked(source)).toEqual([]);
	});
});

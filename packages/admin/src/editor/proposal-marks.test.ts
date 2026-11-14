import type { Doc, Inline } from "@monti-cms/core";
import { type Node as EditorNode, Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { type Convert, takeProposal } from "./proposal-marks";

/** A body of paragraphs and pictures, each with its block id: enough of the editor to take a proposal into. */
const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { group: "block", content: "text*", attrs: { blockId: { default: null } } },
		image: { group: "block", atom: true, attrs: { blockId: { default: null } } },
		text: {},
	},
});
const p = (id: string, text = "") => schema.node("paragraph", { blockId: id }, text ? [schema.text(text)] : []);
const image = (id: string) => schema.node("image", { blockId: id });

/** As the editor's own (`docFromEditor`): the empty paragraph under a last picture is not stored. */
const convert: Convert = {
	fromEditor: (node) => {
		const blocks: Doc["blocks"] = [];
		node.forEach((child) => {
			blocks.push(
				child.type.name === "image"
					? { id: child.attrs.blockId, type: "image" }
					: {
							id: child.attrs.blockId,
							type: "paragraph",
							...(child.textContent ? { content: [{ type: "text", text: child.textContent }] } : {}),
						},
			);
		});
		const last = blocks.at(-1);
		if (last?.type === "paragraph" && !last.content && blocks.at(-2)?.type === "image") blocks.pop();
		// A body that is one empty paragraph is an empty body.
		if (blocks.length === 1 && last?.type === "paragraph" && !last.content) return { type: "doc", blocks: [] };
		return { type: "doc", blocks };
	},
	toEditor: (doc) =>
		schema.node(
			"doc",
			null,
			doc.blocks.map((block) =>
				block.type === "image"
					? image(block.id)
					: p(block.id, ((block.content ?? []) as { text?: string }[]).map((each) => each.text ?? "").join("")),
			),
		),
};

const ids = (doc: EditorNode) => {
	const all: string[] = [];
	doc.forEach((child) => {
		all.push(child.attrs.blockId);
	});
	return all;
};

describe("taking a body proposal into the editor", () => {
	it("05 T121 the empty line just opened under a last picture stays, with the caret in it, when a proposal changes blocks above it", () => {
		const doc = schema.node("doc", null, [p("b_1", "첫 문단"), p("b_2", "지울 문단"), image("b_3"), p("b_4")]);
		// The caret is in the empty line under the picture.
		const caret = doc.content.size - 1;
		const state = EditorState.create({ doc, selection: TextSelection.create(doc, caret) });
		const tr = takeProposal(state, { id: "item", ops: [{ op: "remove", blocks: ["b_2"] }] }, convert);
		expect(ids(tr.doc)).toEqual(["b_1", "b_3", "b_4"]);
		const selection = tr.selection;
		expect(selection.empty).toBe(true);
		expect(selection.$from.parent.attrs.blockId).toBe("b_4");
	});

	it("05 T121 an empty paragraph the body does store (after text) is changed like any other block", () => {
		const doc = schema.node("doc", null, [p("b_1", "첫 문단"), p("b_2")]);
		const state = EditorState.create({ doc });
		const tr = takeProposal(state, { id: "item", ops: [{ op: "remove", blocks: ["b_2"] }] }, convert);
		expect(ids(tr.doc)).toEqual(["b_1"]);
	});

	it("05 T121 a body that is one empty paragraph takes new blocks in its place, with no line added after them", () => {
		const doc = schema.node("doc", null, [p("b_1")]);
		const state = EditorState.create({ doc });
		const tr = takeProposal(
			state,
			{
				id: "item",
				ops: [
					{ op: "insert", after: null, blocks: [{ type: "paragraph", content: [{ type: "text", text: "새 문단" }] }] },
				],
			},
			convert,
		);
		expect(tr.doc.childCount).toBe(1);
		expect(tr.doc.textContent).toBe("새 문단");
	});
});

/** A body with marks: bold, code, a link and a code link, as the editor holds them, and a translation's link on a paragraph. */
const marked = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: {
			group: "block",
			content: "text*",
			attrs: { blockId: { default: null }, data: { default: null }, link: { default: null } },
		},
		text: {},
	},
	marks: {
		bold: {},
		code: {},
		link: { attrs: { href: {} } },
		codeRef: { attrs: { block: {}, anchor: {} } },
	},
});

const markedConvert: Convert = {
	fromEditor: (node) => {
		const blocks: Doc["blocks"] = [];
		node.forEach((child) => {
			const content: Inline[] = [];
			child.forEach((text) => {
				const marks = text.marks.map((mark) => ({ type: mark.type.name, ...mark.attrs }));
				content.push({ type: "text", text: text.text ?? "", ...(marks.length ? { marks } : {}) });
			});
			blocks.push({
				id: child.attrs.blockId,
				type: "paragraph",
				...(content.length ? { content } : {}),
				...(child.attrs.link ? { link: child.attrs.link } : {}),
			});
		});
		return { type: "doc", blocks };
	},
	toEditor: (doc) =>
		marked.node(
			"doc",
			null,
			doc.blocks.map((block) =>
				marked.node(
					"paragraph",
					{ blockId: block.id, link: block.link ?? null },
					(block.content ?? []).flatMap((inline) =>
						inline.type === "text"
							? [
									marked.text(
										inline.text,
										(inline.marks ?? []).map(({ type, ...attrs }) => marked.mark(type, attrs)),
									),
								]
							: [],
					),
				),
			),
		),
};

const inlines = (node: EditorNode) => markedConvert.fromEditor(marked.node("doc", null, [node])).blocks[0]?.content;

describe("taking a block's new text into the editor", () => {
	const link = { type: "link", href: "/guide" };
	const before: Inline[] = [
		{ type: "text", text: "Run " },
		{ type: "text", text: "npm test", marks: [{ type: "code" }] },
		{ type: "text", text: " before you " },
		{ type: "text", text: "push", marks: [{ type: "bold" }] },
		{ type: "text", text: ", as the " },
		{ type: "text", text: "guide", marks: [link] },
		{ type: "text", text: " says." },
	];

	it("05 a rewrite of a paragraph with bold, a link and code words keeps every mark where the tags put it", () => {
		const doc = markedConvert.toEditor({ type: "doc", blocks: [{ id: "b_1", type: "paragraph", content: before }] });
		// The caret in the words that stay ("guide").
		const caret = doc.content.size - 8;
		const state = EditorState.create({ doc, selection: TextSelection.create(doc, caret) });
		const text =
			'Always run <code>npm test</code> before you <bold>push</bold>, as the <link href="/guide">guide</link> says.';
		const tr = takeProposal(state, { id: "item", ops: [{ op: "setText", block: "b_1", text }] }, markedConvert);
		expect(inlines(tr.doc.child(0))).toEqual([{ type: "text", text: "Always run " }, ...before.slice(1)]);
		expect(tr.doc.child(0).attrs.blockId).toBe("b_1");
		// Only the changed words were put in: the caret is still on the same letter.
		expect(tr.selection.from).toBe(caret + "Always r".length - "R".length);
	});

	it("04 a translation of an undecided block keeps its code link and leaves none of the source's words", () => {
		const pending = { from: "s_1", seen: "h", state: "pending" };
		// The undecided block is empty in the editor: the source's words are its placeholder.
		const doc = marked.node("doc", null, [marked.node("paragraph", { blockId: "b_1", link: pending })]);
		const state = EditorState.create({ doc });
		const text = 'Set it up on <codeRef block="b_code" anchor="setup">this line</codeRef>.';
		const tr = takeProposal(state, { id: "item", ops: [{ op: "setText", block: "b_1", text }] }, markedConvert);
		expect(tr.doc.child(0).textContent).toBe("Set it up on this line.");
		expect(inlines(tr.doc.child(0))).toEqual([
			{ type: "text", text: "Set it up on " },
			{ type: "text", text: "this line", marks: [{ type: "codeRef", block: "b_code", anchor: "setup" }] },
			{ type: "text", text: "." },
		]);
		expect(tr.doc.child(0).attrs.link).toEqual(pending);
	});
});

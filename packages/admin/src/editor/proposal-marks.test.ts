import type { Doc, Inline } from "@monti-cms/core";
import { getSchema } from "@tiptap/core";
import { type Node as EditorNode, Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog";
import { type Convert, convertFor, takeProposal } from "./proposal-marks";
import { bodyExtensions } from "./schema";

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
	blockToEditor: () => {
		throw new Error("not used: these tests change whole blocks");
	},
	blockFromEditor: () => {
		throw new Error("not used: these tests change whole blocks");
	},
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

/** The editor's real schema and converter for a site with paragraphs, bold, code, links and code links. */
const kit: Catalog = {
	blocks: [
		{
			type: "paragraph",
			label: "Paragraph",
			description: "",
			menu: "text",
			holds: "text",
			children: null,
			attrs: null,
		},
	],
	marks: [
		{ type: "bold", label: "Bold", attrs: null },
		{ type: "code", label: "Code", attrs: null },
		{ type: "link", label: "Link", attrs: { properties: { href: {} } } },
		{ type: "codeRef", label: "Code link", attrs: { properties: { block: {}, anchor: {} } } },
	],
	headings: [2, 3, 4],
};
const real = getSchema(bodyExtensions(kit, () => ""));
const production = convertFor(real, kit);
const stateOf = (doc: Doc) => EditorState.create({ schema: real, doc: production.toEditor(doc) });
const inlines = (doc: EditorNode) => production.fromEditor(doc).blocks[0]?.content;
const setText = (block: string, text: string) => ({ id: "item", ops: [{ op: "setText" as const, block, text }] });

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
		const state = stateOf({ type: "doc", blocks: [{ id: "b_1", type: "paragraph", content: before }] });
		const text =
			'Always run <code>npm test</code> before you <bold>push</bold>, as the <link href="/guide">guide</link> says.';
		const tr = takeProposal(state, setText("b_1", text), production);
		expect(inlines(tr.doc)).toEqual([{ type: "text", text: "Always run " }, ...before.slice(1)]);
		expect(tr.doc.child(0).attrs.blockId).toBe("b_1");
	});

	it("05 a caret in words that stay between two changes stays on its letter", () => {
		const doc = production.toEditor({
			type: "doc",
			blocks: [{ id: "b_1", type: "paragraph", content: [{ type: "text", text: "Hello middle world" }] }],
		});
		// The caret in "mi|ddle".
		const caret = 1 + "Hello mi".length;
		const state = EditorState.create({ schema: real, doc, selection: TextSelection.create(doc, caret) });
		const tr = takeProposal(state, setText("b_1", "Hi middle earth"), production);
		expect(tr.doc.textContent).toBe("Hi middle earth");
		expect(tr.selection.from).toBe(1 + "Hi mi".length);
	});

	it("05 a mark put on words that stay is taken too", () => {
		const state = stateOf({
			type: "doc",
			blocks: [{ id: "b_1", type: "paragraph", content: [{ type: "text", text: "one two" }] }],
		});
		const tr = takeProposal(state, setText("b_1", "one <bold>two</bold>"), production);
		expect(inlines(tr.doc)).toEqual([
			{ type: "text", text: "one " },
			{ type: "text", text: "two", marks: [{ type: "bold" }] },
		]);
	});

	it("04 a translation whose one undecided block is the whole body goes in with its code link and none of the source's words", () => {
		const pending = { from: "s_1", seen: "h", state: "pending" as const };
		// The undecided block is empty in the editor: the source's words are its placeholder.
		const state = stateOf({ type: "doc", blocks: [{ id: "b_1", type: "paragraph", link: pending }] });
		const text = 'Set it up on <codeRef block="b_code" anchor="setup">this line</codeRef>.';
		const tr = takeProposal(state, setText("b_1", text), production);
		expect(tr.doc.textContent).toBe("Set it up on this line.");
		expect(inlines(tr.doc)).toEqual([
			{ type: "text", text: "Set it up on " },
			{ type: "text", text: "this line", marks: [{ type: "codeRef", block: "b_code", anchor: "setup" }] },
			{ type: "text", text: "." },
		]);
		expect(tr.doc.child(0).attrs.link).toEqual(pending);
	});
});

describe("a body's conversion keeps a translation's undecided paragraph", () => {
	it("04 a body that is one empty paragraph paired with a source block is that paragraph, not an empty body", () => {
		const pending = { from: "s_1", seen: "h", state: "pending" as const };
		const doc: Doc = { type: "doc", blocks: [{ id: "b_1", type: "paragraph", link: pending }] };
		expect(production.fromEditor(production.toEditor(doc))).toEqual(doc);
	});
});

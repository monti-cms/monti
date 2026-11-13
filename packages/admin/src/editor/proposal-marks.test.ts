import type { Doc } from "@monti-cms/core";
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

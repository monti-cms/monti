import type { Doc } from "@monti-cms/core";
import { getSchema } from "@tiptap/core";
import { Node as PmNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog";
import { clearFormats } from "./commands";
import { docFromEditor, docToEditor } from "./convert";
import { bodyExtensions } from "./schema";

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
		{ type: "link", label: "Link", attrs: { properties: { href: {} } } },
		{ type: "tooltip", label: "Tooltip", attrs: { properties: { text: {} } } },
		{ type: "color", label: "Text colour", attrs: { properties: { color: {}, background: {} } } },
	],
	headings: [2, 3, 4],
};

/** One paragraph whose words carry a tooltip, a colour, bold and a link. */
const body: Doc = {
	type: "doc",
	blocks: [
		{
			id: "b_1",
			type: "paragraph",
			content: [
				{ type: "text", text: "RSC", marks: [{ type: "tooltip", text: "React Server Components" }] },
				{
					type: "text",
					text: " 빨간",
					marks: [{ type: "color", color: "red", background: "yellow" }, { type: "bold" }],
				},
				{ type: "text", text: " 링크", marks: [{ type: "link", href: "https://example.dev" }] },
			],
		},
	],
};

describe("clear formatting takes off the site's marks (doc 18)", () => {
	it("18-4 a tooltip and a text or background colour are formats the eraser takes off, like bold; a link stays", () => {
		const schema = getSchema(bodyExtensions(kit, () => ""));
		const doc = PmNode.fromJSON(schema, docToEditor(body, kit));
		let state = EditorState.create({ schema, doc });
		state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)));
		expect(
			clearFormats(state, (tr) => {
				state = state.apply(tr);
			}),
		).toBe(true);
		expect(docFromEditor(state.doc.toJSON(), kit).blocks[0]?.content).toEqual([
			{ type: "text", text: "RSC 빨간" },
			{ type: "text", text: " 링크", marks: [{ type: "link", href: "https://example.dev" }] },
		]);
	});
});

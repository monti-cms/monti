import type { Doc } from "@monti-cms/core";
import { getSchema, Node as TiptapNode } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import type { AdminBlockDefinition } from "../operations/admin-context";
import type { Catalog } from "./catalog";
import { docFromEditor, docToEditor } from "./convert";
import { bodyExtensions, markName, nodeName } from "./schema";

const catalog: Catalog = {
	blocks: [
		{
			type: "callout",
			label: "Callout",
			description: "A highlighted note.",
			menu: "insert",
			holds: "text",
			children: null,
			attrs: null,
		},
	],
	marks: [{ type: "highlight", label: "Highlight", attrs: null }],
	headings: [2, 3, 4],
};

describe("site editor extensions", () => {
	it("03-1 uses a block's runtime Editor component and keeps custom marks editable", () => {
		const definition: AdminBlockDefinition = {
			type: "callout",
			label: "Callout",
			description: "A highlighted note.",
			menu: "insert",
			holds: "text",
			Editor: () => null,
		};
		const extensions = bodyExtensions(catalog, () => "Callout", new Map([[definition.type, definition]]));
		const extension = extensions.find((each) => each.name === nodeName("callout"));
		expect(extension).toBeInstanceOf(TiptapNode);
		expect((extension as TiptapNode).config.addNodeView).toBeTypeOf("function");
		expect(extensions.map((extension) => extension.name)).toContain(markName("highlight"));

		const doc: Doc = {
			type: "doc",
			blocks: [
				{
					id: "b1",
					type: "callout",
					content: [{ type: "text", text: "Important", marks: [{ type: "highlight" }] }],
				},
			],
		};
		expect(docFromEditor(docToEditor(doc, catalog), catalog)).toEqual(doc);
	});
});

describe("the body as it is saved", () => {
	const kit: Catalog = {
		...catalog,
		blocks: [
			...catalog.blocks,
			{
				type: "divider",
				label: "Divider",
				description: "",
				menu: "insert",
				holds: "nothing",
				children: null,
				attrs: null,
			},
		],
	};
	const divider = { id: "b1", type: "divider" };
	const callout = { id: "b1", type: "callout", content: [{ type: "text" as const, text: "Note" }] };
	it("03-1 an empty paragraph opened under a last block with no text of its own is not kept", () => {
		const opened: Doc = { type: "doc", blocks: [divider, { id: "b2", type: "paragraph" }] };
		expect(docFromEditor(docToEditor(opened, kit), kit)).toEqual({ type: "doc", blocks: [divider] });
	});
	it("03-1 an empty paragraph after a block with text is the writer's: kept", () => {
		const after: Doc = { type: "doc", blocks: [callout, { id: "b2", type: "paragraph" }] };
		expect(docFromEditor(docToEditor(after, catalog), catalog).blocks).toHaveLength(2);
	});
	it("03-1 an empty paragraph after a paragraph, or one paired with a source block, is kept", () => {
		const blank: Doc = {
			type: "doc",
			blocks: [
				{ id: "b1", type: "paragraph", content: [{ type: "text", text: "One" }] },
				{ id: "b2", type: "paragraph" },
			],
		};
		expect(docFromEditor(docToEditor(blank, catalog), catalog).blocks).toHaveLength(2);
		const paired: Doc = {
			type: "doc",
			blocks: [divider, { id: "b2", type: "paragraph", link: { from: "s2", seen: "h", state: "pending" } }],
		};
		expect(docFromEditor(docToEditor(paired, kit), kit).blocks).toHaveLength(2);
	});
});

describe("code blocks in the editor", () => {
	const codeKit: Catalog = {
		blocks: [
			{
				type: "codeBlock",
				label: "Code",
				description: "",
				menu: "text",
				holds: "text",
				children: null,
				attrs: { properties: { language: {}, lines: {} } },
			},
		],
		marks: [
			{ type: "bold", label: "Bold", attrs: null, inCode: "also" },
			{ type: "link", label: "Link", attrs: { properties: { href: {} } }, inCode: null },
			{ type: "codeTip", label: "Tooltip", attrs: { properties: { text: {} } }, inCode: "only" },
		],
		headings: [2, 3, 4],
	};
	it("17-1 a code block's text keeps the code's own marks and its line effects through the editor", () => {
		const doc: Doc = {
			type: "doc",
			blocks: [
				{
					id: "b1",
					type: "codeBlock",
					attrs: { language: "ts", lines: [{ name: "plus", start: 0, end: 1 }] },
					content: [
						{ type: "text", text: "use", marks: [{ type: "bold" }, { type: "codeTip", text: "a hook" }] },
						{ type: "text", text: "State" },
					],
				},
			],
		};
		const schema = getSchema(bodyExtensions(codeKit, () => "Code"));
		const node = schema.nodeFromJSON(docToEditor(doc, codeKit));
		expect(() => node.check()).not.toThrow();
		expect(schema.nodes[nodeName("codeBlock")].allowsMarkType(schema.marks[markName("link")])).toBe(false);
		expect(docFromEditor(node.toJSON(), codeKit)).toEqual(doc);
	});
});

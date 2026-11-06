import type { Doc } from "@monti-cms/core";
import { Node as TiptapNode } from "@tiptap/core";
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

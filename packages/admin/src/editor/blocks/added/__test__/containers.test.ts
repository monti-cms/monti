import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { Editor } from "@tiptap/core";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { deleteBlock, duplicateBlock } from "../../../block-commands";
import { BLOCK_INSERT_ACTIONS } from "../../../block-inserts";
import { buildEditorExtensions } from "../../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../../tiptap-content";

const sources = [
	':::callout{variant="note"}\n\n강조 **문장**\n\n:::',
	':::collapsible{title="제목"}\n\n본문\n\n:::',
	'::::tabs\n:::tab{label="a"}\n첫째\n:::\n:::tab{label="b"}\n둘째\n:::\n::::',
	"::::columns\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::",
	'::::columns{widths="60,40"}\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::',
];

describe("container body editing", () => {
	it.each(
		sources.map(
			(source, index) =>
				[source, ["cmsCallout", "cmsCollapsible", "cmsTabs", "cmsColumns", "cmsColumns"][index]] as const,
		),
	)("MDX → Tiptap schema → MDX round trip: %s", (source, expected) => {
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.type).toBe(expected);
		const editor = new Editor({ extensions: buildEditorExtensions(), content });
		const saved = tiptapToMdx(editor.getJSON()).trim();
		// The serializer normalizes whitespace inside containers. The result that went through the editor must be the same canonical form.
		expect(saved).toBe(serialize(toDocument(analyze(source))).trim());
		editor.destroy();
	});

	it.each(["callout", "collapsible", "tabs", "columns"])("inserts the default %s structure via slash", (name) => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>/</p>" });
		BLOCK_INSERT_ACTIONS[name]?.(editor, { from: 1, to: 2 });
		expect(editor.getJSON().content?.[0]?.type).toBe(`cms${name[0]?.toUpperCase()}${name.slice(1)}`);
		expect(tiptapToMdx(editor.getJSON())).toContain(`:${name}`);
		editor.destroy();
	});

	it("HTML copy and paste also keep container attributes", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[0] ?? "") });
		const html = editor.getHTML();
		const element = document.createElement("div");
		element.innerHTML = html;
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.variant).toBe("note");
		expect(parsed.firstChild?.attrs.originalAttributes).toEqual(editor.state.doc.firstChild?.attrs.originalAttributes);
		editor.destroy();
	});

	it("long titles are also preserved through HTML copy and paste", () => {
		const title = "긴 제목".repeat(5000);
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[0] ?? "") });
		editor.commands.updateAttributes("cmsCallout", { values: { title } });
		const element = document.createElement("div");
		element.innerHTML = editor.getHTML();
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.title).toBe(title);
		editor.destroy();
	});

	it("a callout without body opens with an empty paragraph, and saving it left empty restores it without body", () => {
		const source = ':::callout{variant="info" title="제목만"}\n:::';
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.type).toBe("cmsCallout");
		expect(content.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
		const editor = new Editor({ extensions: buildEditorExtensions(), content });
		expect(tiptapToMdx(editor.getJSON()).trim()).toBe(serialize(toDocument(analyze(source))).trim());
		editor.commands.insertContentAt(2, "새 본문");
		expect(tiptapToMdx(editor.getJSON())).toContain("새 본문");
		editor.destroy();
	});

	it("empty containers (except callouts) and a Tab outside its parent go to the raw-source box", () => {
		const empty = mdxToTiptap(':::collapsible{title="a"}\n:::');
		expect(empty.content?.[0]?.type).not.toBe("cmsCollapsible");
		const orphan = mdxToTiptap(':::tab{label="a"}\n본문\n:::');
		expect(orphan.content?.[0]?.type).not.toBe("cmsTab");
		const loneColumn = mdxToTiptap(":::column\n본문\n:::");
		expect(loneColumn.content?.[0]?.type).not.toBe("cmsColumn");
		const invalid = mdxToTiptap(':::callout\n:::tab{label="a"}\n본문\n:::\n:::');
		expect(invalid.content?.[0]?.type).not.toBe("cmsCallout");
	});

	it("handle commands cannot bypass the minimum and maximum Tab count", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[2] ?? "") });
		expect(deleteBlock(editor, 1)).toBe(false);
		let pos = 0;
		for (let i = 0; i < 6; i++) {
			const tab = editor.state.doc.firstChild?.child(i);
			if (!tab) break;
			pos =
				1 +
				Array.from({ length: i }, (_, idx) => editor.state.doc.firstChild?.child(idx).nodeSize ?? 0).reduce(
					(a, b) => a + b,
					0,
				);
			expect(duplicateBlock(editor, pos)).toBe(i < 6);
		}
		expect(editor.state.doc.firstChild?.childCount).toBe(8);
		expect(duplicateBlock(editor, 1)).toBe(false);
		editor.destroy();
	});

	it("the schema rejects fewer than two tabs or two columns", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>시작</p>" });
		const tab = editor.schema.nodes.cmsTab;
		const column = editor.schema.nodes.cmsColumn;
		expect(tab).toBeDefined();
		expect(column).toBeDefined();
		if (!tab || !column) throw new Error("Container child node missing");
		expect(editor.schema.nodes.cmsTabs?.contentMatch.matchType(tab)?.validEnd).toBe(false);
		expect(editor.schema.nodes.cmsColumns?.contentMatch.matchType(column)?.validEnd).toBe(false);
		editor.destroy();
	});
});

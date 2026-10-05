import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { Editor } from "@tiptap/core";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { deleteBlock, duplicateBlock } from "../../../block-commands";
import { BLOCK_INSERT_ACTIONS } from "../../../block-inserts";
import { buildEditorExtensions } from "../../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../../tiptap-content";

const sources = [
	'<Callout variant="note">\n\n강조 **문장**\n\n</Callout>',
	'<Collapsible title="제목">\n\n본문\n\n</Collapsible>',
	'<Tabs>\n\n<Tab label="a">\n\n첫째\n\n</Tab>\n\n<Tab label="b">\n\n둘째\n\n</Tab>\n\n</Tabs>',
	"<Columns>\n\n<Column>\n\n왼쪽\n\n</Column>\n\n<Column>\n\n오른쪽\n\n</Column>\n\n</Columns>",
	'<Columns widths="60,40">\n\n<Column>\n\n왼쪽\n\n</Column>\n\n<Column>\n\n오른쪽\n\n</Column>\n\n</Columns>',
	'<CodeExplorer open="a.ts">\n\n```ts title="a.ts"\nconst a = 1;\n```\n\n```text title="dir/"\n\n```\n\n</CodeExplorer>',
];

describe("container body editing", () => {
	it.each(
		sources.map(
			(source, index) =>
				[
					source,
					["cmsCallout", "cmsCollapsible", "cmsTabs", "cmsColumns", "cmsColumns", "cmsCodeExplorer"][index],
				] as const,
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
		expect(tiptapToMdx(editor.getJSON())).toContain(`<${name[0]?.toUpperCase()}${name.slice(1)}`);
		editor.destroy();
	});

	it("inserts the code explorer via slash with one code block, not an empty paragraph", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>/</p>" });
		BLOCK_INSERT_ACTIONS["code-explorer"]?.(editor, { from: 1, to: 2 });
		const block = editor.state.doc.firstChild;
		expect(block?.type.name).toBe("cmsCodeExplorer");
		expect(block?.childCount).toBe(1);
		expect(block?.firstChild?.type.name).toBe("codeBlock");
		expect(block?.firstChild?.attrs).toMatchObject({ language: "ts", meta: 'title="src/index.ts"' });
		expect(tiptapToMdx(editor.getJSON())).toContain('<CodeExplorer>\n\n```ts title="src/index.ts"');
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
		const source = '<Callout variant="info" title="제목만" />';
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
		const empty = mdxToTiptap('<Collapsible title="a" />');
		expect(empty.content?.[0]?.type).not.toBe("cmsCollapsible");
		const orphan = mdxToTiptap('<Tab label="a">\n\n본문\n\n</Tab>');
		expect(orphan.content?.[0]?.type).not.toBe("cmsTab");
		const loneColumn = mdxToTiptap("<Column>\n\n본문\n\n</Column>");
		expect(loneColumn.content?.[0]?.type).not.toBe("cmsColumn");
		const invalid = mdxToTiptap('<Callout>\n\n<Tab label="a">\n\n본문\n\n</Tab>\n\n</Callout>');
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

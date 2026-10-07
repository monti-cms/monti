import type { CmsNode } from "@monti-cms/core/document";
import { Editor } from "@tiptap/core";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { para, storedDoc, text, withoutIds } from "../../../../test/stored-doc";
import { deleteBlock, duplicateBlock } from "../../../block-commands";
import { blockInsertActions } from "../../../block-inserts";
import { buildEditorExtensions } from "../../../extensions";
import { storedToTiptap, tiptapToStored } from "../../../tiptap-content";

const tab = (label: string, body: string): CmsNode => ({ type: "tab", attrs: { label }, content: [para(body)] });
const column = (body: string): CmsNode => ({ type: "column", content: [para(body)] });
const codeBlock = (language: string, meta: string, code: string): CmsNode => ({
	type: "codeBlock",
	attrs: { language, meta, code },
});

const sources: CmsNode[] = [
	{
		type: "callout",
		attrs: { variant: "note" },
		content: [{ type: "paragraph", content: [text("강조 "), text("문장", [{ type: "bold" }])] }],
	},
	{ type: "collapsible", attrs: { title: "제목" }, content: [para("본문")] },
	{ type: "tabs", content: [tab("a", "첫째"), tab("b", "둘째")] },
	{ type: "columns", content: [column("왼쪽"), column("오른쪽")] },
	{ type: "columns", attrs: { widths: "60,40" }, content: [column("왼쪽"), column("오른쪽")] },
	{
		type: "code-explorer",
		attrs: { open: "a.ts" },
		content: [codeBlock("ts", 'title="a.ts"', "const a = 1;"), codeBlock("text", 'title="dir/"', "")],
	},
];
const docOfSource = (index: number) => storedDoc(sources[index] as CmsNode);
const tiptapOfSource = (index: number) => storedToTiptap(testSite, docOfSource(index));

describe("container body editing", () => {
	it.each(
		["cmsCallout", "cmsCollapsible", "cmsTabs", "cmsColumns", "cmsColumns", "cmsCodeExplorer"].map(
			(expected, index) => [index, expected] as const,
		),
	)("stored document -> Tiptap schema -> stored document round trip: block %i", (index, expected) => {
		const source = docOfSource(index);
		const content = storedToTiptap(testSite, source);
		expect(content.content?.[0]?.type).toBe(expected);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content });
		// The ids of the blocks inside a container, tabs and columns included, survive the round trip.
		expect(tiptapToStored(testSite, editor.getJSON())).toEqual(source);
		editor.destroy();
	});

	it.each(["callout", "collapsible", "tabs", "columns"])("inserts the default %s structure via slash", (name) => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>/</p>" });
		blockInsertActions(testSite)[name]?.(editor, { from: 1, to: 2 });
		expect(editor.getJSON().content?.[0]?.type).toBe(`cms${name[0]?.toUpperCase()}${name.slice(1)}`);
		expect(tiptapToStored(testSite, editor.getJSON()).content[0]?.type).toBe(name);
		editor.destroy();
	});

	it("inserts the code explorer via slash with one code block, not an empty paragraph", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>/</p>" });
		blockInsertActions(testSite)["code-explorer"]?.(editor, { from: 1, to: 2 });
		const block = editor.state.doc.firstChild;
		expect(block?.type.name).toBe("cmsCodeExplorer");
		expect(block?.childCount).toBe(1);
		expect(block?.firstChild?.type.name).toBe("codeBlock");
		expect(block?.firstChild?.attrs).toMatchObject({ language: "ts", meta: 'title="src/index.ts"' });
		expect(tiptapToStored(testSite, editor.getJSON()).content[0]).toMatchObject({
			type: "code-explorer",
			content: [{ type: "codeBlock", attrs: { language: "ts", meta: 'title="src/index.ts"' } }],
		});
		editor.destroy();
	});

	it("HTML copy and paste also keep container attributes", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOfSource(0) });
		const html = editor.getHTML();
		const element = document.createElement("div");
		element.innerHTML = html;
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.variant).toBe("note");
		editor.destroy();
	});

	it("long titles are also preserved through HTML copy and paste", () => {
		const title = "긴 제목".repeat(5000);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOfSource(0) });
		editor.commands.updateAttributes("cmsCallout", { values: { title } });
		const element = document.createElement("div");
		element.innerHTML = editor.getHTML();
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.title).toBe(title);
		editor.destroy();
	});

	it("a callout without body opens with an empty paragraph, and saving it left empty restores it without body", () => {
		const source = storedDoc({ type: "callout", attrs: { variant: "info", title: "제목만" } });
		const content = storedToTiptap(testSite, source);
		expect(content.content?.[0]?.type).toBe("cmsCallout");
		expect(content.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content });
		const emptySaved = tiptapToStored(testSite, editor.getJSON()).content[0];
		expect(emptySaved).toMatchObject({ type: "callout", attrs: { variant: "info", title: "제목만" } });
		expect(emptySaved?.content ?? []).toEqual([]);
		editor.commands.insertContentAt(2, "새 본문");
		expect(JSON.stringify(tiptapToStored(testSite, editor.getJSON()))).toContain("새 본문");
		editor.destroy();
	});

	it("empty containers (except callouts) and a Tab outside its parent go to the raw-source box", () => {
		const empty = storedToTiptap(testSite, storedDoc({ type: "collapsible", attrs: { title: "a" } }));
		expect(empty.content?.[0]?.type).not.toBe("cmsCollapsible");
		const orphan = storedToTiptap(testSite, storedDoc(tab("a", "본문")));
		expect(orphan.content?.[0]?.type).not.toBe("cmsTab");
		const loneColumn = storedToTiptap(testSite, storedDoc(column("본문")));
		expect(loneColumn.content?.[0]?.type).not.toBe("cmsColumn");
		const invalid = storedToTiptap(testSite, storedDoc({ type: "callout", content: [tab("a", "본문")] }));
		expect(invalid.content?.[0]?.type).not.toBe("cmsCallout");
	});

	it("handle commands cannot bypass the minimum and maximum Tab count", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOfSource(2) });
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
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>시작</p>" });
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

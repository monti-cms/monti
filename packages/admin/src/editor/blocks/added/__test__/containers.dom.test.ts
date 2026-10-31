import type { CmsNode } from "@monti-cms/core/document";
import { Editor } from "@tiptap/core";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { para, storedDoc, text } from "../../../../test/stored-doc";
import { deleteBlock, duplicateBlock } from "../../../block-commands";
import { blockInsertActions } from "../../../block-inserts";
import { buildEditorExtensions } from "../../../extensions";
import { OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "../../../tiptap-content";

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
	)("FMT-R2 stored document -> Tiptap schema -> stored document round trip: block %i", (index, expected) => {
		const source = docOfSource(index);
		const content = storedToTiptap(testSite, source);
		expect(content.content?.[0]?.type).toBe(expected);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content });
		// The ids of the blocks inside a container, tabs and columns included, survive the round trip.
		expect(tiptapToStored(testSite, editor.getJSON())).toEqual(source);
		editor.destroy();
	});

	it.each([
		"callout",
		"collapsible",
		"tabs",
		"columns",
	])("EDIT-B2 inserts the default %s structure via slash", (name) => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>/</p>" });
		blockInsertActions(testSite)[name]?.(editor, { from: 1, to: 2 });
		expect(editor.getJSON().content?.[0]?.type).toBe(`cms${name[0]?.toUpperCase()}${name.slice(1)}`);
		expect(tiptapToStored(testSite, editor.getJSON()).content[0]?.type).toBe(name);
		editor.destroy();
	});

	it("EDIT-B1 HTML copy and paste also keep container attributes", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOfSource(0) });
		const html = editor.getHTML();
		const element = document.createElement("div");
		element.innerHTML = html;
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.variant).toBe("note");
		editor.destroy();
	});

	it("FMT-R2 empty containers (except callouts) and a Tab outside its parent go to the raw-source box", () => {
		const boxed = (node: CmsNode) => storedToTiptap(testSite, storedDoc(node)).content?.[0]?.type;
		expect(boxed({ type: "collapsible", attrs: { title: "a" } })).toBe(OPAQUE_BLOCK_NAME);
		expect(boxed(tab("a", "본문"))).toBe(OPAQUE_BLOCK_NAME);
		expect(boxed(column("본문"))).toBe(OPAQUE_BLOCK_NAME);
		expect(boxed({ type: "callout", content: [tab("a", "본문")] })).toBe(OPAQUE_BLOCK_NAME);
	});

	it("EDIT-B1 handle commands cannot bypass the minimum and maximum Tab count", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOfSource(2) });
		// The first tab starts right inside the tabs block. Two tabs is the minimum, eight the maximum.
		const firstTab = 1;
		expect(deleteBlock(editor, firstTab)).toBe(false);
		for (let count = 2; count < 8; count += 1) expect(duplicateBlock(editor, firstTab)).toBe(true);
		expect(editor.state.doc.firstChild?.childCount).toBe(8);
		expect(duplicateBlock(editor, firstTab)).toBe(false);
		expect(editor.state.doc.firstChild?.childCount).toBe(8);
		editor.destroy();
	});
});

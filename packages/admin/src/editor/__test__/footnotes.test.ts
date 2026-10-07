import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { para, storedDoc, text } from "../../test/stored-doc";
import { buildEditorExtensions } from "../extensions";
import { footnoteNumbers, nextFootnoteLabel } from "../footnote-nodes";
import { editorMessages } from "../messages";
import { filterCommands, slashCommands } from "../slash-command";
import { OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "../tiptap-content";

const t = testSite.createTranslator(editorMessages);

const ref = (label: string): CmsNode => ({ type: "footnoteReference", attrs: { label } });
const def = (label: string, ...content: CmsNode[]): CmsNode => ({
	type: "footnoteDefinition",
	attrs: { label },
	content,
});
const code = (source: string): CmsNode => ({ type: "codeBlock", attrs: { language: "ts", meta: "", code: source } });
const line = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });

const tiptapOf = (doc: StoredDocument) => storedToTiptap(testSite, doc);
const createEditor = (doc: StoredDocument) =>
	new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf(doc) });
/** The stored document the editor content is saved as. */
const saved = (json: JSONContent) => tiptapToStored(testSite, json);

const SOURCE = storedDoc(
	line(text("First"), ref("a"), text(" and second"), ref("b"), text(" and first again"), ref("a"), text(".")),
	def("a", para("Note A")),
	def("b", para("Note B"), code("x();")),
);

describe("footnotes in the visual editor", () => {
	it("loads footnotes as editable nodes instead of a source box", () => {
		const json = tiptapOf(SOURCE);
		expect(JSON.stringify(json)).not.toContain(OPAQUE_BLOCK_NAME);
		expect(json.content?.[0]?.content?.map((node) => node.type)).toEqual([
			"text",
			"footnoteReference",
			"text",
			"footnoteReference",
			"text",
			"footnoteReference",
			"text",
		]);
		expect(json.content?.[0]?.content?.[1]?.attrs).toEqual({ label: "a" });
		const [, definitionA, definitionB] = json.content ?? [];
		expect(definitionA).toMatchObject({ type: "footnoteDefinition", attrs: { label: "a" } });
		expect(definitionB?.content?.map((node) => node.type)).toEqual(["paragraph", "codeBlock"]);
	});

	it("round-trips through the editor unchanged", () => {
		expect(saved(tiptapOf(SOURCE))).toEqual(SOURCE);
		const editor = createEditor(SOURCE);
		expect(saved(editor.getJSON())).toEqual(SOURCE);
		editor.destroy();
	});

	it("gives an empty definition a paragraph so it can be typed into, and saves it as empty", () => {
		const doc = storedDoc(line(text("Text"), ref("1")), def("1", para()));
		const json = tiptapOf(doc);
		expect(json.content?.[1]?.content).toEqual([expect.objectContaining({ type: "paragraph", content: [] })]);
		const editor = createEditor(doc);
		expect(saved(editor.getJSON())).toEqual(doc);
		editor.destroy();
	});

	it("keeps footnote references in headings, lists and table cells editable", () => {
		const doc = storedDoc(
			{ type: "heading", attrs: { level: 2 }, content: [text("Title"), ref("1")] },
			{ type: "bulletList", content: [{ type: "listItem", content: [line(text("item"), ref("2"))] }] },
			{
				type: "table",
				content: [
					{ type: "tableRow", content: [{ type: "tableCell", attrs: { header: true }, content: [text("h")] }] },
					{
						type: "tableRow",
						content: [{ type: "tableCell", attrs: { header: false }, content: [text("cell"), ref("3")] }],
					},
				],
			},
			def("1", para("a")),
			def("2", para("b")),
			def("3", para("c")),
		);
		expect(JSON.stringify(tiptapOf(doc))).not.toContain(OPAQUE_BLOCK_NAME);
		const once = saved(tiptapOf(doc));
		expect(once.content.map((node) => node.type)).toEqual(doc.content.map((node) => node.type));
		expect(JSON.stringify(once)).toContain('"label":"3"');
		expect(saved(tiptapOf(once))).toEqual(once);
	});

	it("moves a definition nested by pasting or dragging out to the top level when saving", () => {
		const stored = saved({
			type: "doc",
			content: [
				{
					type: "footnoteDefinition",
					attrs: { label: "1" },
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "outer" }] },
						{
							type: "footnoteDefinition",
							attrs: { label: "2" },
							content: [{ type: "paragraph", content: [{ type: "text", text: "inner" }] }],
						},
					],
				},
			],
		});
		expect(stored.content.map((node) => [node.type, node.attrs?.label])).toEqual([
			["footnoteDefinition", "1"],
			["footnoteDefinition", "2"],
		]);
		expect(JSON.stringify(stored.content[1])).toContain("inner");
	});
});

describe("footnote numbering", () => {
	it("numbers labels by their first reference and leaves the stored label alone", () => {
		const editor = createEditor(
			storedDoc(
				line(text("B"), ref("zebra"), text(" A"), ref("apple"), text(" B again"), ref("zebra")),
				def("apple", para("a")),
				def("zebra", para("z")),
			),
		);
		expect([...footnoteNumbers(editor.state.doc)]).toEqual([
			["zebra", 1],
			["apple", 2],
		]);
		expect(saved(editor.getJSON()).content.map((node) => node.attrs?.label)).toContain("zebra");
		editor.destroy();
	});

	it("matches labels case-insensitively", () => {
		const editor = createEditor(
			storedDoc(line(text("A"), ref("Note"), text(" B"), ref("note")), def("note", para("x"))),
		);
		expect([...footnoteNumbers(editor.state.doc)]).toEqual([["note", 1]]);
		editor.destroy();
	});

	it("shows the number on references and definitions and flags missing and unused ones", () => {
		const editor = createEditor(
			storedDoc(line(text("A B"), ref("y")), def("y", para("y")), def("spare", para("spare"))),
		);
		// A reference whose definition was removed (a marker without a definition is plain text in the stored form).
		editor.commands.insertContentAt(2, { type: "footnoteReference", attrs: { label: "x" } });
		const dom = editor.view.dom;
		const references = [...dom.querySelectorAll("[data-footnote-ref]")];
		expect(references.map((el) => el.getAttribute("data-footnote-number"))).toEqual(["1", "2"]);
		// `x` has no definition.
		expect(references.map((el) => el.hasAttribute("data-footnote-missing"))).toEqual([true, false]);
		const definitions = [...dom.querySelectorAll("[data-footnote-definition]")];
		expect(definitions.map((el) => el.getAttribute("data-footnote-badge"))).toEqual(["2 · y", "spare"]);
		expect(definitions.map((el) => el.hasAttribute("data-footnote-unused"))).toEqual([false, true]);
		editor.destroy();
	});

	it("shows a stored reference without a definition as a flagged chip and keeps it across saves", () => {
		const doc = storedDoc(line(text("Text"), ref("1"), text(" here.")));
		const editor = createEditor(doc);
		const chip = editor.view.dom.querySelector("[data-footnote-ref]");
		expect(chip?.getAttribute("data-footnote-number")).toBe("1");
		expect(chip?.hasAttribute("data-footnote-missing")).toBe(true);
		const again = saved(editor.getJSON());
		expect(again).toEqual(doc);
		expect(saved(tiptapOf(again))).toEqual(doc);
		editor.destroy();
	});

	it("renumbers when a reference is added before another", () => {
		const editor = createEditor(storedDoc(line(text("A"), ref("a")), def("a", para("a"))));
		editor.commands.insertContentAt(1, { type: "footnoteReference", attrs: { label: "z" } });
		expect([...footnoteNumbers(editor.state.doc)]).toEqual([
			["z", 1],
			["a", 2],
		]);
		const first = editor.view.dom.querySelector("[data-footnote-ref]");
		expect(first?.getAttribute("data-footnote-number")).toBe("1");
		editor.destroy();
	});
});

describe("Footnote slash command", () => {
	const item = () => slashCommands(testSite).find((command) => command.title === t("slash.footnote.title"));

	it("is in the menu and found by its keywords", () => {
		expect(item()).toBeDefined();
		for (const keyword of t("slash.footnote.keywords").split(",")) {
			expect(filterCommands(testSite, keyword.trim()).map((command) => command.title)).toContain(
				t("slash.footnote.title"),
			);
		}
		expect(filterCommands(testSite, "footnote").map((command) => command.title)).toContain(t("slash.footnote.title"));
	});

	it("inserts a reference at the cursor and appends an empty definition with the next numeric label", () => {
		const editor = createEditor(storedDoc(para("Hello world"), def("1", para("one")), def("3", para("three"))));
		// Cursor after "Hello", as if "/footnote" had just been typed there.
		editor.commands.insertContentAt(6, "/fn");
		item()?.action(editor, { from: 6, to: 9 });

		const json: JSONContent = editor.getJSON();
		expect(json.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "footnoteReference", "text"]);
		expect(json.content?.[0]?.content?.[1]?.attrs).toEqual({ label: "4" });
		// The editor keeps an empty paragraph after the last block, and the definition goes before it.
		const last = json.content?.findLast((node) => node.type === "footnoteDefinition");
		expect(last).toMatchObject({ type: "footnoteDefinition", attrs: { label: "4" } });
		expect(last?.content).toEqual([expect.objectContaining({ type: "paragraph" })]);
		expect(last?.content?.[0]?.content).toBeUndefined();
		const stored = saved(json);
		expect(stored.content.map((node) => [node.type, node.attrs?.label])).toEqual([
			["paragraph", undefined],
			["footnoteDefinition", "1"],
			["footnoteDefinition", "3"],
			["footnoteDefinition", "4"],
		]);
		expect(stored.content[0]?.content?.map((node) => node.type)).toEqual(["text", "footnoteReference", "text"]);
		expect(JSON.stringify(stored.content[3]?.content)).not.toContain("text");
		editor.destroy();
	});

	it("keeps new definitions together without piling up empty paragraphs", () => {
		const editor = createEditor(storedDoc(para("One two"), def("1", para("one"))));
		editor.commands.setTextSelection(4);
		item()?.action(editor, { from: 4, to: 4 });
		editor.commands.setTextSelection(1);
		item()?.action(editor, { from: 1, to: 1 });
		const types = (editor.getJSON().content ?? []).map((node) => node.type);
		expect(types.filter((type) => type === "paragraph")).toHaveLength(2);
		expect(types.slice(0, 4)).toEqual(["paragraph", "footnoteDefinition", "footnoteDefinition", "footnoteDefinition"]);
		const stored = saved(editor.getJSON());
		expect(stored.content.map((node) => [node.type, node.attrs?.label])).toEqual([
			["paragraph", undefined],
			["footnoteDefinition", "1"],
			["footnoteDefinition", "2"],
			["footnoteDefinition", "3"],
		]);
		expect(stored.content[0]?.content?.map((node) => node.attrs?.label ?? node.text)).toEqual([
			"3",
			"One",
			"2",
			" two",
		]);
		editor.destroy();
	});

	it("moves the cursor into the new definition so the note can be typed", () => {
		const editor = createEditor(storedDoc(para("Hello")));
		editor.commands.setTextSelection(6);
		item()?.action(editor, { from: 6, to: 6 });
		editor.commands.insertContent("The note");
		const stored = saved(editor.getJSON());
		expect(stored.content[0]?.content?.map((node) => node.type)).toEqual(["text", "footnoteReference"]);
		expect(stored.content[1]).toMatchObject({ type: "footnoteDefinition", attrs: { label: "1" } });
		expect(JSON.stringify(stored.content[1])).toContain("The note");
		editor.destroy();
	});

	it("starts at 1 and does not touch the existing numbering", () => {
		const editor = createEditor(storedDoc(para("Plain text")));
		expect(nextFootnoteLabel(editor.state.doc)).toBe("1");
		editor.destroy();
	});

	it("uses one more than the largest numeric label and ignores text labels", () => {
		const editor = createEditor(
			storedDoc(line(text("A"), ref("2"), text(" B"), ref("note")), def("2", para("two")), def("note", para("n"))),
		);
		expect(nextFootnoteLabel(editor.state.doc)).toBe("3");
		editor.destroy();
	});

	it("does nothing where an inline reference cannot go, such as in a code block", () => {
		const editor = createEditor(storedDoc(code("code")));
		editor.commands.setTextSelection(3);
		expect(item()?.action(editor, { from: 3, to: 3 })).toBeUndefined();
		expect(JSON.stringify(editor.getJSON())).not.toContain("footnote");
		editor.destroy();
	});
});

describe("deleting footnotes", () => {
	it("keeps the definition when its only reference is deleted", () => {
		const editor = createEditor(storedDoc(line(text("A"), ref("1")), def("1", para("note"))));
		let position = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "footnoteReference") position = pos;
		});
		editor.commands.deleteRange({ from: position, to: position + 1 });
		const json: JSONContent = editor.getJSON();
		expect(JSON.stringify(json)).not.toContain("footnoteReference");
		expect(json.content?.[1]).toMatchObject({ type: "footnoteDefinition", attrs: { label: "1" } });
		expect(JSON.stringify(saved(json))).toContain("note");
		editor.destroy();
	});
});

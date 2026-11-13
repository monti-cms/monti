import type { Doc } from "@monti-cms/core";
import { type Editor, getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog";
import { docToEditor } from "./convert";
import { bodyExtensions } from "./schema";
import { blockTexts, type Found, fixInEditor, stands } from "./text-check";

const block = (type: string): Catalog["blocks"][number] => ({
	type,
	label: type,
	description: type,
	menu: null,
	holds: "text",
	children: null,
	attrs: null,
});
const catalog: Catalog = {
	blocks: [block("paragraph"), block("footnote"), block("codeBlock")],
	marks: [{ type: "bold", label: "Bold", attrs: null }],
	headings: [2, 3],
};
const schema = getSchema(bodyExtensions(catalog, () => "", new Map()));

/** A body as the editor holds it, with a stand-in for the editor that applies what is dispatched. */
function bodyOf(doc: Doc) {
	let state = EditorState.create({ doc: schema.nodeFromJSON(docToEditor(doc, catalog)) });
	const editor = {
		get state() {
			return state;
		},
		view: {
			dispatch: (tr: Parameters<EditorState["apply"]>[0]) => {
				state = state.apply(tr);
			},
		},
	} as unknown as Editor;
	return { editor, doc: () => state.doc, texts: () => blockTexts(state.doc).map(({ id, text }) => ({ id, text })) };
}

const found = (texts: { id: string; text: string }[], block: string, words: string, replacement: string): Found => {
	const text = texts.find((each) => each.id === block)?.text ?? "";
	const from = text.indexOf(words);
	return { block, from, to: from + words.length, replacement, was: words };
};

const text = (value: string, marks?: { type: string }[]) => ({
	type: "text" as const,
	text: value,
	...(marks ? { marks } : {}),
});

describe("a text check's view of the body (doc 14, textCheck)", () => {
	it("14-5 words on either side of a line break or a footnote's mark are not read as one word, and code is not read", () => {
		const body = bodyOf({
			type: "doc",
			blocks: [
				{ id: "p1", type: "paragraph", content: [text("line one"), { type: "hardBreak" }, text("line two")] },
				{ id: "p2", type: "paragraph", content: [text("noted"), { type: "footnoteRef", id: "f1" }, text("here")] },
				{ id: "f1", type: "footnote", attrs: { id: "f1" }, content: [text("the note")] },
				{ id: "c1", type: "codeBlock", content: [text("const x = 1;")] },
				{ id: "p3", type: "paragraph" },
			],
		} as Doc);
		expect(body.texts()).toEqual([
			{ id: "p1", text: "line one\nline two" },
			{ id: "p2", text: "noted￼here" },
			{ id: "f1", text: "the note" },
		]);
	});

	it("14-5 a fix replaces the words where they are, keeps their marks, and several go in back to front", () => {
		const body = bodyOf({
			type: "doc",
			blocks: [
				{
					id: "p1",
					type: "paragraph",
					content: [text("first "), text("wrnog", [{ type: "bold" }]), text(" and agian")],
				},
			],
		} as Doc);
		const texts = body.texts();
		const fixes = [found(texts, "p1", "wrnog", "wrong"), found(texts, "p1", "agian", "again")];
		expect(fixInEditor(body.editor, fixes)).toBe(2);
		expect(body.texts()).toEqual([{ id: "p1", text: "first wrong and again" }]);
		const bold = body.doc().firstChild?.child(1);
		expect(bold?.text).toBe("wrong");
		expect(bold?.marks.map((mark) => mark.type.name)).toEqual(["bold"]);
	});

	it("14-5 a finding that reaches over a line break or a footnote's mark is not put in: neither is taken out", () => {
		const body = bodyOf({
			type: "doc",
			blocks: [
				{ id: "p1", type: "paragraph", content: [text("line one"), { type: "hardBreak" }, text("line two")] },
				{ id: "p2", type: "paragraph", content: [text("noted"), { type: "footnoteRef", id: "f1" }, text("here")] },
				{ id: "f1", type: "footnote", attrs: { id: "f1" }, content: [text("the note")] },
			],
		} as Doc);
		const texts = body.texts();
		const over = [found(texts, "p1", "one\nline", "one line"), found(texts, "p2", "noted￼here", "noted here")];
		expect(over.map((each) => stands(body.doc(), each))).toEqual([false, false]);
		expect(fixInEditor(body.editor, over)).toBe(0);
		expect(body.texts()).toEqual(texts);
		// Words after the break are still fixed where they are.
		expect(fixInEditor(body.editor, [found(texts, "p1", "two", "2")])).toBe(1);
		expect(body.texts()[0]).toEqual({ id: "p1", text: "line one\nline 2" });
	});

	it("14-5 a finding whose words changed since the check is left alone", () => {
		const body = bodyOf({
			type: "doc",
			blocks: [{ id: "p1", type: "paragraph", content: [text("some wrnog word")] }],
		} as Doc);
		const stale: Found = { ...found(body.texts(), "p1", "wrnog", "wrong"), was: "other" };
		expect(fixInEditor(body.editor, [stale])).toBe(0);
		expect(body.texts()).toEqual([{ id: "p1", text: "some wrnog word" }]);
	});
});

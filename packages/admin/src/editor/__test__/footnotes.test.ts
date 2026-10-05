import { createTranslator } from "@monti-cms/core/client";
import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../extensions";
import { footnoteNumbers, nextFootnoteLabel } from "../footnote-nodes";
import { editorMessages } from "../messages";
import { filterCommands, SLASH_COMMANDS } from "../slash-command";
import { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "../tiptap-content";

const t = createTranslator(editorMessages);

const createEditor = (mdx: string) => new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(mdx) });

const SOURCE = [
	"First[^a] and second[^b] and first again[^a].",
	"",
	"[^a]: Note A",
	"",
	"[^b]: Note B",
	"",
	"    ```ts",
	"    x();",
	"    ```",
	"",
].join("\n");

describe("footnotes in the visual editor", () => {
	it("loads footnotes as editable nodes instead of a source box", () => {
		const json = mdxToTiptap(SOURCE);
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
		expect(tiptapToMdx(mdxToTiptap(SOURCE))).toBe(SOURCE);
		const editor = createEditor(SOURCE);
		expect(tiptapToMdx(editor.getJSON())).toBe(SOURCE);
		editor.destroy();
	});

	it("gives an empty definition a paragraph so it can be typed into, and saves it as empty", () => {
		const mdx = "Text[^1]\n\n[^1]:\n";
		const json = mdxToTiptap(mdx);
		expect(json.content?.[1]?.content).toEqual([{ type: "paragraph", content: [] }]);
		const editor = createEditor(mdx);
		expect(tiptapToMdx(editor.getJSON())).toBe(mdx);
		editor.destroy();
	});

	it("keeps footnote references in headings, lists and table cells editable", () => {
		const mdx = "## Title[^1]\n\n- item[^2]\n\n| h |\n| --- |\n| cell[^3] |\n\n[^1]: a\n\n[^2]: b\n\n[^3]: c\n";
		expect(JSON.stringify(mdxToTiptap(mdx))).not.toContain(OPAQUE_BLOCK_NAME);
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});

	it("moves a definition nested by pasting or dragging out to the top level when saving", () => {
		const mdx = tiptapToMdx({
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
		expect(mdx).toBe("[^1]: outer\n\n[^2]: inner\n");
	});
});

describe("footnote numbering", () => {
	it("numbers labels by their first reference and leaves the stored label alone", () => {
		const editor = createEditor("B[^zebra] A[^apple] B again[^zebra]\n\n[^apple]: a\n\n[^zebra]: z\n");
		expect([...footnoteNumbers(editor.state.doc)]).toEqual([
			["zebra", 1],
			["apple", 2],
		]);
		expect(tiptapToMdx(editor.getJSON())).toContain("[^zebra]: z");
		editor.destroy();
	});

	it("matches labels case-insensitively", () => {
		const editor = createEditor("A[^Note] B[^note]\n\n[^note]: x\n");
		expect([...footnoteNumbers(editor.state.doc)]).toEqual([["note", 1]]);
		editor.destroy();
	});

	it("shows the number on references and definitions and flags missing and unused ones", () => {
		const editor = createEditor("A B[^y]\n\n[^y]: y\n\n[^spare]: spare\n");
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
		const mdx = "Text[^1] here.\n";
		const editor = createEditor(mdx);
		const chip = editor.view.dom.querySelector("[data-footnote-ref]");
		expect(chip?.getAttribute("data-footnote-number")).toBe("1");
		expect(chip?.hasAttribute("data-footnote-missing")).toBe(true);
		const saved = tiptapToMdx(editor.getJSON());
		expect(saved).toBe(mdx);
		expect(tiptapToMdx(mdxToTiptap(saved))).toBe(mdx);
		editor.destroy();
	});

	it("renumbers when a reference is added before another", () => {
		const editor = createEditor("A[^a]\n\n[^a]: a\n");
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
	const item = () => SLASH_COMMANDS.find((command) => command.title === t("slash.footnote.title"));

	it("is in the menu and found by its keywords", () => {
		expect(item()).toBeDefined();
		for (const keyword of t("slash.footnote.keywords").split(",")) {
			expect(filterCommands(keyword.trim()).map((command) => command.title)).toContain(t("slash.footnote.title"));
		}
		expect(filterCommands("footnote").map((command) => command.title)).toContain(t("slash.footnote.title"));
	});

	it("inserts a reference at the cursor and appends an empty definition with the next numeric label", () => {
		const editor = createEditor("Hello world\n\n[^1]: one\n\n[^3]: three\n");
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
		expect(tiptapToMdx(json)).toBe("Hello[^4] world\n\n[^1]: one\n\n[^3]: three\n\n[^4]:\n");
		editor.destroy();
	});

	it("keeps new definitions together without piling up empty paragraphs", () => {
		const editor = createEditor("One two\n\n[^1]: one\n");
		editor.commands.setTextSelection(4);
		item()?.action(editor, { from: 4, to: 4 });
		editor.commands.setTextSelection(1);
		item()?.action(editor, { from: 1, to: 1 });
		const types = (editor.getJSON().content ?? []).map((node) => node.type);
		expect(types.filter((type) => type === "paragraph")).toHaveLength(2);
		expect(types.slice(0, 4)).toEqual(["paragraph", "footnoteDefinition", "footnoteDefinition", "footnoteDefinition"]);
		expect(tiptapToMdx(editor.getJSON())).toBe("[^3]One[^2] two\n\n[^1]: one\n\n[^2]:\n\n[^3]:\n");
		editor.destroy();
	});

	it("moves the cursor into the new definition so the note can be typed", () => {
		const editor = createEditor("Hello\n\n");
		editor.commands.setTextSelection(6);
		item()?.action(editor, { from: 6, to: 6 });
		editor.commands.insertContent("The note");
		expect(tiptapToMdx(editor.getJSON())).toBe("Hello[^1]\n\n[^1]: The note\n");
		editor.destroy();
	});

	it("starts at 1 and does not touch the existing numbering", () => {
		const editor = createEditor("Plain text");
		expect(nextFootnoteLabel(editor.state.doc)).toBe("1");
		editor.destroy();
	});

	it("uses one more than the largest numeric label and ignores text labels", () => {
		const editor = createEditor("A[^2] B[^note]\n\n[^2]: two\n\n[^note]: n\n");
		expect(nextFootnoteLabel(editor.state.doc)).toBe("3");
		editor.destroy();
	});

	it("does nothing where an inline reference cannot go, such as in a code block", () => {
		const editor = createEditor("```ts\ncode\n```\n");
		editor.commands.setTextSelection(3);
		expect(item()?.action(editor, { from: 3, to: 3 })).toBeUndefined();
		expect(JSON.stringify(editor.getJSON())).not.toContain("footnote");
		editor.destroy();
	});
});

describe("deleting footnotes", () => {
	it("keeps the definition when its only reference is deleted", () => {
		const editor = createEditor("A[^1]\n\n[^1]: note\n");
		let position = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "footnoteReference") position = pos;
		});
		editor.commands.deleteRange({ from: position, to: position + 1 });
		const json: JSONContent = editor.getJSON();
		expect(JSON.stringify(json)).not.toContain("footnoteReference");
		expect(json.content?.[1]).toMatchObject({ type: "footnoteDefinition", attrs: { label: "1" } });
		expect(tiptapToMdx(json)).toContain("[^1]: note");
		editor.destroy();
	});
});

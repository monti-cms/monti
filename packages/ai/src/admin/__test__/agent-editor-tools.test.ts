import type { BrowserFormat, OpenEditor } from "@monti-cms/admin";
import { describe, expect, it } from "vitest";
import { answerEditorTool, EDITOR_TOOLS, isEditorTool } from "../agent-editor-tools";

const BODY = { type: "doc", version: 1, content: [{ type: "paragraph" }] } as never;

/** A format that writes a body as a marker, so the test sees which document it was asked about. */
const format = (name: string): BrowserFormat => ({
	name,
	label: name,
	export: (doc) => `  <${name}:${JSON.stringify(doc).length}>  `,
	import: () => ({ ok: false, issues: [] }),
});

const editor = (overrides: Partial<ReturnType<OpenEditor["readEntry"]>> = {}): OpenEditor => ({
	readEntry: () => ({
		collection: "post",
		entryId: "e1",
		slug: "hello",
		fields: { title: "Unsaved title", tags: ["a"], summary: null },
		body: BODY,
		hasUnsavedChanges: true,
		...overrides,
	}),
	readSelection: () => ({ text: "words", block: { id: "b1", type: "paragraph", text: "some words" } }),
});

describe("editor tools", () => {
	it("knows which tool names the browser answers", () => {
		for (const name of EDITOR_TOOLS) expect(isEditorTool(name)).toBe(true);
		expect(isEditorTool("entries_list")).toBe(false);
	});

	it("answers `editor_read` with the entry as the form holds it and the body as text in the format", () => {
		const answer = answerEditorTool("editor_read", editor(), format("mdx"));
		expect(answer).toEqual({
			collection: "post",
			entryId: "e1",
			slug: "hello",
			fields: { title: "Unsaved title", tags: ["a"], summary: null },
			body: expect.stringMatching(/^<mdx:\d+>$/),
			bodyFormat: "mdx",
			unsavedChanges: true,
		});
	});

	it("reads the editor again on every call, so an answer is never an old one", () => {
		let title = "first";
		const live: OpenEditor = {
			readEntry: () => editor({ fields: { title } }).readEntry(),
			readSelection: () => editor().readSelection(),
		};
		expect(answerEditorTool("editor_read", live, format("mdx")).fields.title).toBe("first");
		title = "second";
		expect(answerEditorTool("editor_read", live, format("mdx")).fields.title).toBe("second");
	});

	it("says there is no body text when the site has no format to write it in, instead of guessing one", () => {
		const answer = answerEditorTool("editor_read", editor({ entryId: null, hasUnsavedChanges: false }), undefined);
		expect(answer).toMatchObject({ entryId: null, body: null, bodyFormat: null, unsavedChanges: false });
	});

	it("answers `editor_selection` with the selected text and the block at the cursor with its id", () => {
		expect(answerEditorTool("editor_selection", editor(), format("mdx"))).toEqual({
			text: "words",
			block: { id: "b1", type: "paragraph", text: "some words" },
		});
	});
});

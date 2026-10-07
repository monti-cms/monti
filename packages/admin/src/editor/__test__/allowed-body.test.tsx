import type { BodyAllowed } from "@monti-cms/core/client";
import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { docOf } from "../../test/mdx";
import { renderWithSite } from "../../test/site";
import { editorAllowance } from "../allowed";
import { cleanSlice } from "../allowed-extension";
import { editorMessages } from "../messages";
import { filterCommands } from "../slash-command";
import { CmsEditor } from "../tiptap-editor";

/**
 * A body that limits its blocks and marks: what the editor offers and accepts, and that a body written before the list changed opens and saves as it is.
 */
const t = testSite.createTranslator(editorMessages);

beforeAll(() => {
	// jsdom has no clipboard events; ProseMirror makes one to paste HTML.
	(globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??= class extends Event {
		clipboardData = null;
	};
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

/** The site's blocks that the slash and component menus insert. The list keeps the first one and leaves the others out (the site decides which they are). */
const insertable = testSite.ADDED_BLOCKS.filter((block) => block.editor.view === "node" && block.editor.insertable);
const KEPT = insertable[0]?.name ?? "";
const LEFT_OUT = insertable.slice(1).map((block) => block.name);

const LIMITED: BodyAllowed = { blocks: [KEPT, "image"], marks: ["bold", "link"], headings: [2, 3] };

const text = (value: string, ...marks: string[]): CmsNode => ({
	type: "text",
	text: value,
	...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 3, content });
const table = (cell: string): CmsNode => ({
	type: "table",
	content: [{ type: "tableRow", content: [{ type: "tableCell", content: [text(cell)] }] }],
});

const open = async (body: StoredDocument, allowed?: BodyAllowed) => {
	let editor: Editor | null = null;
	const onChange = vi.fn();
	renderWithSite(
		<CmsEditor
			doc={body}
			allowed={allowed}
			onChange={onChange}
			onEditor={(ready) => {
				editor = ready ?? editor;
			}}
		/>,
	);
	const toolbar = await screen.findByRole("toolbar", { name: t("toolbar.format") });
	await waitFor(() => expect(editor).not.toBeNull());
	return { toolbar, editor: editor as unknown as Editor, onChange };
};

const buttonNames = (toolbar: HTMLElement) =>
	within(toolbar)
		.getAllByRole("button")
		.map((button) => button.getAttribute("aria-label") || button.textContent);

const saved = (onChange: ReturnType<typeof vi.fn>): StoredDocument => onChange.mock.lastCall?.[0];

/** Types a character the way the keyboard does, so input rules run. */
const type = (editor: Editor, value: string) => {
	const { from, to } = editor.state.selection;
	const handled = editor.view.someProp("handleTextInput", (handler) =>
		handler(editor.view, from, to, value, () => editor.state.tr),
	);
	if (!handled) editor.view.dispatch(editor.state.tr.insertText(value, from, to));
};

describe("what the toolbar offers", () => {
	it("offers everything when the body has no list", async () => {
		const { toolbar } = await open(docOf("text"));
		const names = buttonNames(toolbar);
		for (const name of [t("toolbar.table"), t("toolbar.quote"), t("toolbar.codeBlock"), t("toolbar.footnote")]) {
			expect(names).toContain(name);
		}
		expect(names).toContain(t("toolbar.align"));
		expect(names).toContain(t("toolbar.script"));
		expect(names).toContain(t("toolbar.upload"));
		expect(names).toContain(t("inlineMarks.italic"));
	});

	it("leaves out the blocks, marks and tools the list does not allow, and keeps the ones it does", async () => {
		const { toolbar } = await open(docOf("text"), LIMITED);
		const names = buttonNames(toolbar);
		for (const name of [
			t("toolbar.table"),
			t("toolbar.quote"),
			t("toolbar.codeBlock"),
			t("toolbar.footnote"),
			t("toolbar.divider"),
			t("toolbar.align"),
			t("toolbar.script"),
			t("inlineMarks.italic"),
			t("inlineMarks.strike"),
		]) {
			expect(names).not.toContain(name);
		}
		expect(names).toContain(t("inlineMarks.bold"));
		expect(names).toContain(t("toolbar.link"));
		// Images are allowed, so uploads stay.
		expect(names).toContain(t("toolbar.upload"));
		// The component menu lists only the block the list keeps.
		fireEvent.click(within(toolbar).getByRole("button", { name: t("customBlockMenu.label") }));
		const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent ?? "");
		expect(items).toHaveLength(1);
	});

	it("offers only the heading levels the list allows", async () => {
		const { toolbar } = await open(docOf("text"), LIMITED);
		fireEvent.click(within(toolbar).getByRole("button", { name: t("toolbar.paragraph") }));
		const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent ?? "");
		expect(items).toContain(t("toolbar.heading", { level: 2 }));
		expect(items).toContain(t("toolbar.heading", { level: 3 }));
		expect(items).not.toContain(t("toolbar.heading", { level: 4 }));
	});
});

describe("the slash menu", () => {
	const titles = (allowed?: BodyAllowed) =>
		filterCommands(testSite, "", [], [], editorAllowance(testSite, allowed)).map(
			(item) => item.block ?? `h${item.heading}`,
		);

	it("lists only the blocks and heading levels the list allows", () => {
		const all = titles();
		expect(all).toEqual(
			expect.arrayContaining(["table", "taskList", "codeBlock", "h4", ...insertable.map((block) => block.name)]),
		);
		const limited = titles(LIMITED);
		expect(limited).toEqual(expect.arrayContaining([KEPT, "image", "h2", "h3"]));
		for (const name of ["table", "taskList", "codeBlock", "blockquote", "h4", "footnotes", ...LEFT_OUT]) {
			expect(limited).not.toContain(name);
		}
	});

	it("keeps the items that are not blocks (paragraph, lists, internal link)", () => {
		const limited = filterCommands(testSite, "", [], [], editorAllowance(testSite, { blocks: [] }));
		expect(limited.filter((item) => item.block !== undefined)).toEqual([]);
		// Paragraph, the headings and the internal link are not blocks of the list.
		expect(limited.length).toBeGreaterThanOrEqual(5);
	});
});

describe("input rules, commands and paste", () => {
	it("does not turn `> ` into a quote when quotes are not allowed, and does when they are", async () => {
		const blocked = await open(docOf("x"), LIMITED);
		blocked.editor.commands.setContent("<p>&gt;</p>");
		blocked.editor.commands.setTextSelection(2);
		type(blocked.editor, " ");
		expect(blocked.editor.isActive("blockquote")).toBe(false);
		cleanup();

		const allowed = await open(docOf("x"), { ...LIMITED, blocks: ["blockquote"] });
		allowed.editor.commands.setContent("<p>&gt;</p>");
		allowed.editor.commands.setTextSelection(2);
		type(allowed.editor, " ");
		expect(allowed.editor.isActive("blockquote")).toBe(true);
	});

	it("does not turn `#### ` into a heading of a level the list does not allow, and does for one it allows", async () => {
		const { editor } = await open(docOf("x"), LIMITED);
		editor.commands.setContent("<p>###</p>");
		editor.commands.setTextSelection(4);
		type(editor, " ");
		expect(editor.isActive("heading", { level: 3 })).toBe(true);
		cleanup();

		const four = await open(docOf("x"), LIMITED);
		four.editor.commands.setContent("<p>####</p>");
		four.editor.commands.setTextSelection(5);
		type(four.editor, " ");
		expect(four.editor.isActive("heading")).toBe(false);
	});

	it("refuses a command that would add a block the list does not allow", async () => {
		const { editor } = await open(docOf("text"), LIMITED);
		editor.commands.insertTable({ rows: 1, cols: 1 });
		editor.commands.toggleBlockquote();
		editor.commands.toggleBold();
		expect(editor.getJSON().content?.map((node) => node.type)).toEqual(["paragraph"]);
	});

	it("pastes a block the list does not allow as its text in paragraphs, and drops marks it does not allow", async () => {
		const { editor } = await open(docOf("start"), LIMITED);
		editor.commands.focus("end");
		editor.view.pasteHTML(
			"<table><tbody><tr><td>cell one</td><td>cell two</td></tr></tbody></table><blockquote><p>quoted <em>slanted</em> <strong>strong</strong></p></blockquote>",
		);
		const json = JSON.stringify(editor.getJSON());
		expect(json).not.toContain('"table"');
		expect(json).not.toContain('"blockquote"');
		expect(json).not.toContain('"italic"');
		expect(json).toContain("cell one");
		expect(json).toContain("cell two");
		expect(json).toContain("slanted");
		expect(json).toContain('"bold"');
	});

	it("keeps the text of a pasted block and a heading of another level (cleanSlice)", async () => {
		const { editor } = await open(docOf("x"), LIMITED);
		const allowance = editorAllowance(testSite, LIMITED);
		const source = editor.schema.nodeFromJSON({
			type: "doc",
			content: [
				{ type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "four" }] },
				{ type: "horizontalRule" },
				{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "two" }] },
			],
		});
		const cleaned = cleanSlice(source.slice(0, source.content.size), allowance, editor.schema);
		expect(cleaned.content.toJSON()).toMatchObject([
			{ type: "paragraph", content: [{ type: "text", text: "four" }] },
			{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "two" }] },
		]);
		expect(cleaned.content.childCount).toBe(2);
	});
});

describe("a body that holds what the list no longer allows", () => {
	const legacy = doc(
		paragraph(text("before")),
		table("kept cell"),
		paragraph(text("slanted", "italic"), text(" and "), text("bold", "bold")),
		{ type: "heading", attrs: { level: 4 }, content: [text("deep")] },
	);

	it("opens and shows it", async () => {
		const { editor } = await open(legacy, LIMITED);
		const types = editor.getJSON().content?.map((node) => node.type);
		expect(types).toEqual(["paragraph", "table", "paragraph", "heading"]);
		expect(editor.view.dom.querySelector("table")).not.toBeNull();
		expect(editor.view.dom.querySelector("h4")).not.toBeNull();
	});

	it("saves it unchanged after an edit elsewhere", async () => {
		const { editor, onChange } = await open(legacy, LIMITED);
		editor.commands.setTextSelection(2);
		editor.commands.insertContent("X");
		await waitFor(() => expect(onChange).toHaveBeenCalled());
		const content = saved(onChange).content;
		expect(content.map((node) => node.type)).toEqual(["paragraph", "table", "paragraph", "heading"]);
		expect(JSON.stringify(content[1])).toContain("kept cell");
		expect(JSON.stringify(content[2])).toContain('"italic"');
		expect(content[3]?.attrs).toMatchObject({ level: 4 });
	});

	it("lets the writer edit inside it, and add more of a type the body already holds", async () => {
		const { editor, onChange } = await open(legacy, LIMITED);
		// Edit the text of the table cell.
		let cellText = 0;
		editor.state.doc.descendants((node, pos) => {
			if (node.isText && node.text === "kept cell") cellText = pos;
		});
		editor.commands.insertContentAt(cellText + 1, "!");
		await waitFor(() => expect(JSON.stringify(saved(onChange))).toContain("k!ept cell"));
		// Duplicate the table: a type the body holds can be added again.
		const before = editor.state.doc.childCount;
		editor.commands.insertContentAt(
			0,
			editor.schema
				.nodeFromJSON({
					type: "table",
					content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }],
				})
				.toJSON(),
		);
		expect(editor.state.doc.childCount).toBe(before + 1);
	});

	it("applies a stored body that replaces the shown one, whatever it holds", async () => {
		let editor: Editor | null = null;
		const props = {
			onChange: vi.fn(),
			allowed: LIMITED,
			onEditor: (ready: Editor | null) => {
				editor = ready ?? editor;
			},
		};
		const view = renderWithSite(<CmsEditor doc={docOf("plain")} {...props} />);
		await waitFor(() => expect(editor).not.toBeNull());
		view.rerender(<CmsEditor doc={legacy} {...props} />);
		await waitFor(() => expect((editor as unknown as Editor).view.dom.querySelector("table")).not.toBeNull());
	});
});

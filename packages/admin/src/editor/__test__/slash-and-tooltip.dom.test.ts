import { type CmsConfig, defineBlock } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { storedDoc, text } from "../../test/stored-doc";
import { blockInsertActions, OPEN_MEDIA_PICKER_EVENT } from "../block-inserts";
import { buildEditorExtensions } from "../extensions";
import { editorMessages } from "../messages";
import { buildBlockSlashCommands, filterCommands, slashCommands } from "../slash-command";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

const t = testSite.createTranslator(editorMessages);
const BLOCK_INSERT_ACTIONS = blockInsertActions(testSite);
const SLASH_COMMANDS = slashCommands(testSite);

/** A stored node as one string, to look for the text inside it. */
const textOf = (node: unknown): string => JSON.stringify(node);

/** A block of the site config, by name (`image`, `file` and `text-align` are core blocks every site has). */
const block = (name: string) => {
	const found = testSite.BLOCKS.find((candidate) => candidate.name === name);
	if (!found) throw new Error(`the site config has no "${name}" block`);
	return found;
};
/** The blocks the "/" menu offers: insertable, with a node view (the image has its own entry). */
const INSERTABLE = testSite.BLOCKS.filter(
	(candidate) => candidate.editor.insertable && candidate.editor.view === "node" && candidate.name !== "image",
);
/** Of those, the blocks whose insert is a source block (a code fence with a preview, or math). */
const SOURCE_BLOCKS = INSERTABLE.filter(
	(candidate) => candidate.syntax.kind === "fence" || candidate.syntax.kind === "math",
);

describe("slash menu insertion driven by block definitions", () => {
	it("WRITE-W1 builds slash commands for BLOCKS entries with insertable=true and view='node'", () => {
		const commands = buildBlockSlashCommands(testSite);

		// Source blocks and containers alike: every site config here has both.
		expect(SOURCE_BLOCKS.length).toBeGreaterThan(0);
		expect(INSERTABLE.some((candidate) => candidate.syntax.kind === "container")).toBe(true);
		const titles = commands.map((c) => c.title);
		for (const { name, label } of INSERTABLE) expect(titles, name).toContain(label);
		// image must be excluded so it does not duplicate the existing hardcoded entry.
		expect(titles).not.toContain(block("image").label);
		// Blocks with insertable=false or a view other than node must be excluded.
		expect(titles).not.toContain(block("text-align").label);
		expect(titles).not.toContain(block("file").label);
		// A text decoration (a mark block) is applied from the formatting tools, not inserted.
		const marks = testSite.BLOCKS.filter((candidate) => candidate.editor.view === "mark");
		expect(marks.length).toBeGreaterThan(0);
		for (const { name, label } of marks) expect(titles, name).not.toContain(label);

		for (const { name, label, editor, description } of SOURCE_BLOCKS) {
			const command = commands.find((c) => c.title === label);
			expect(command?.keywords, name).toEqual(expect.arrayContaining([...(editor.keywords ?? [])]));
			expect(command?.description, name).toBe(description ?? t("slash.blockDescription", { label }));
		}
	});

	it("MEDIA-P1 slash menu and formatting tools share block names, and the file entry opens the library with files only", () => {
		const titles = SLASH_COMMANDS.map((c) => c.title);
		expect(titles).toEqual(
			expect.arrayContaining([
				t("slash.paragraph.title"),
				t("slash.bullet.title"),
				t("slash.ordered.title"),
				t("slash.code.title"),
				t("slash.table.title"),
				t("slash.file.title"),
			]),
		);
		const open = vi.fn();
		window.addEventListener(OPEN_MEDIA_PICKER_EVENT, open);
		const editor = new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>/파일</p>" });
		SLASH_COMMANDS.find((c) => c.title === t("slash.file.title"))?.action(editor, { from: 1, to: 4 });
		window.removeEventListener(OPEN_MEDIA_PICKER_EVENT, open);
		expect(open).toHaveBeenCalledOnce();
		expect(open).toHaveBeenCalledWith(expect.objectContaining({ detail: { kind: "file" } }));
		expect(editor.getText()).toBe("");
		editor.destroy();
	});

	it("WRITE-W1 filterCommands searches block commands by Korean and English keywords", () => {
		// Every keyword of the config, in whatever language the config writes it, finds its block.
		for (const { name, label, editor } of SOURCE_BLOCKS) {
			for (const keyword of editor.keywords ?? []) {
				expect(
					filterCommands(testSite, keyword).some((c) => c.title === label),
					`${name}: ${keyword}`,
				).toBe(true);
			}
		}
		// An entry an extension provides (`inline`) is found by its own keywords, and comes after the text formatting entries and before the block entries.
		const inlineTitle = "Inline extension item";
		const inline = [
			{ title: inlineTitle, group: "insert" as const, description: "", keywords: ["xyzinline"], action: () => {} },
		];
		expect(filterCommands(testSite, "xyzinline").some((c) => c.title === inlineTitle)).toBe(false);
		expect(filterCommands(testSite, "xyzinline", [], inline).map((c) => c.title)).toEqual([inlineTitle]);
		const titles = filterCommands(testSite, "", [], inline).map((c) => c.title);
		expect(titles.indexOf(inlineTitle)).toBeGreaterThan(titles.indexOf(t("slash.internalLink.title")));
		// An extension item sits with the other items that insert something; the components come after them.
		const component = INSERTABLE.find((candidate) => candidate.syntax.kind === "fence");
		expect(titles.indexOf(inlineTitle)).toBeLessThan(titles.indexOf(component?.label ?? ""));
	});
});

describe("stored document after block insert actions", () => {
	const createEditor = () =>
		new Editor({
			extensions: buildEditorExtensions(testSite),
			content: "<p></p>",
		});

	it.each([
		["code", "chart", { type: "codeBlock", attrs: { language: "chart" } }, ["chart bar", "x month", "series views"]],
		["math", "math", { type: "math" }, ["E = mc^2"]],
	] as const)("WRITE-W1 saves a stored %s block after inserting %s", (_, name, stored, texts) => {
		const editor = createEditor();
		BLOCK_INSERT_ACTIONS[name](editor, { from: 1, to: 1 });

		const saved = tiptapToStored(testSite, editor.getJSON()).content[0];
		expect(saved).toMatchObject(stored);
		for (const value of texts) expect(textOf(saved)).toContain(value);
		editor.destroy();
	});
});

/**
 * A text decoration a site adds (`editor.view: "mark"`, like the blocks extension's tooltip), with a required attribute. Defined here so the test
 * runs on any site config.
 */
const noteMark = defineBlock({
	name: "note-mark",
	label: "Note",
	syntax: { kind: "text", directive: "note-mark" },
	component: "NoteMark",
	attributes: { content: { type: "string", label: "Content", required: true, translatable: true } },
	editor: { view: "mark" },
});
const markSite = createSite({ ...testConfig, blocks: [...(testConfig.blocks ?? []), noteMark] } as CmsConfig);

describe("an added text decoration: stored round trip", () => {
	it("FMT-R2 loads a stored added mark into the editor and round-trips it losslessly on re-saving", () => {
		const initial = storedDoc({
			type: "paragraph",
			content: [
				text("본문 속 "),
				text("단어", [{ type: noteMark.name, attrs: { content: "상세 설명" } }]),
				text(" 확인하기"),
			],
		});
		const editor = new Editor({
			extensions: buildEditorExtensions(markSite),
			content: storedToTiptap(markSite, initial),
		});

		expect(editor.isActive("cmsNoteMark")).toBe(false);
		// Move the cursor onto the word
		editor.chain().focus().setTextSelection(7).run();
		expect(editor.isActive("cmsNoteMark")).toBe(true);
		expect(editor.getAttributes("cmsNoteMark").content).toBe("상세 설명");

		expect(tiptapToStored(markSite, editor.getJSON())).toEqual(initial);
		editor.destroy();
	});
});

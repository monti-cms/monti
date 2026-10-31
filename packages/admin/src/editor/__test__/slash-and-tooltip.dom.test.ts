import { defineBlock } from "@monti-cms/core";
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { storedDoc, text } from "../../test/stored-doc";
import { type BlockInsertAction, blockInsertActions, OPEN_MEDIA_PICKER_EVENT } from "../block-inserts";
import { buildEditorExtensions } from "../extensions";
import { editorMessages } from "../messages";
import { buildBlockSlashCommands, filterCommands, slashCommands } from "../slash-command";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

const t = testSite.createTranslator(editorMessages);
const BLOCK_INSERT_ACTIONS = blockInsertActions(testSite);
const SLASH_COMMANDS = slashCommands(testSite);

/** A stored node as one string, to look for the text inside it. */
const textOf = (node: unknown): string => JSON.stringify(node);
const tooltip = (content: string) => [{ type: "tooltip", attrs: { content } }];

/** A block of the reference blog's config, by name (this file runs only with that config). */
const block = (name: string) => {
	const found = testSite.BLOCKS.find((candidate) => candidate.name === name);
	if (!found) throw new Error(`the reference blog config has no "${name}" block`);
	return found;
};
/** The blocks whose insert is a fenced source block (a preview of code). */
const SOURCE_BLOCKS = ["mermaid", "chart", "math"];

describe("slash menu insertion driven by block definitions", () => {
	it("WRITE-W1 builds slash commands for BLOCKS entries with insertable=true and view='node'", () => {
		const commands = buildBlockSlashCommands(testSite);

		// mermaid, chart and math must be included, and the insertable node blocks with them.
		const titles = commands.map((c) => c.title);
		for (const name of [...SOURCE_BLOCKS, "callout", "tabs", "columns"]) {
			expect(titles, name).toContain(block(name).label);
		}
		// image must be excluded so it does not duplicate the existing hardcoded entry.
		expect(titles).not.toContain(block("image").label);
		// Blocks with insertable=false or a view other than node must be excluded.
		expect(titles).not.toContain(block("text-align").label);
		expect(titles).not.toContain(block("file").label);

		for (const name of SOURCE_BLOCKS) {
			const command = commands.find((c) => c.title === block(name).label);
			expect(command?.keywords, name).toEqual(expect.arrayContaining([...(block(name).editor.keywords ?? [])]));
			expect(command?.description, name).toBe(block(name).description);
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
		// Every keyword of the config, Korean and English, finds its block.
		for (const name of SOURCE_BLOCKS) {
			for (const keyword of block(name).editor.keywords ?? []) {
				expect(
					filterCommands(testSite, keyword).some((c) => c.title === block(name).label),
					`${name}: ${keyword}`,
				).toBe(true);
			}
		}
		// Tooltip is a text decoration from the blocks extension, so it is not in the core menu; extension-provided entries (`inline`) come after the text formatting entries and before the block entries.
		const tooltipTitle = block("tooltip").label;
		expect(filterCommands(testSite, "tooltip").some((c) => c.title === tooltipTitle)).toBe(false);
		const inline = [
			{
				title: tooltipTitle,
				group: "insert" as const,
				description: "글자에 설명 달기",
				keywords: ["tooltip"],
				action: () => {},
			},
		];
		expect(filterCommands(testSite, "tooltip", [], inline).map((c) => c.title)).toEqual([tooltipTitle]);
		const titles = filterCommands(testSite, "", [], inline).map((c) => c.title);
		expect(titles.indexOf(tooltipTitle)).toBeGreaterThan(titles.indexOf(t("slash.internalLink.title")));
		// An extension item sits with the other items that insert something; the components come after them.
		expect(titles.indexOf(tooltipTitle)).toBeLessThan(titles.indexOf(block("mermaid").label));
	});
});

describe("stored document after block insert actions", () => {
	const createEditor = () =>
		new Editor({
			extensions: buildEditorExtensions(testSite),
			content: "<p></p>",
		});

	it.each([
		["code", "mermaid", { type: "codeBlock", attrs: { language: "mermaid" } }, ["graph TD", "A --> B"]],
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

describe("setting, editing and removing a tooltip, and stored round trip", () => {
	const createEditor = (html = "<p>안녕하세요 세상입니다</p>") =>
		new Editor({
			extensions: buildEditorExtensions(testSite),
			content: html,
		});

	it("FMT-R2 loads a stored tooltip mark into the editor and round-trips it losslessly on re-saving", () => {
		const initial = storedDoc({
			type: "paragraph",
			content: [text("본문 속 "), text("단어", tooltip("상세 설명")), text(" 확인하기")],
		});
		const json = storedToTiptap(testSite, initial);

		const editor = new Editor({
			extensions: buildEditorExtensions(testSite),
			content: json,
		});

		expect(editor.isActive("cmsTooltip")).toBe(false);
		// Move the cursor onto the word
		editor.chain().focus().setTextSelection(7).run();
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("상세 설명");

		expect(tiptapToStored(testSite, editor.getJSON())).toEqual(initial);
		editor.destroy();
	});
});

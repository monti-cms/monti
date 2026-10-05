import { createTranslator, defineBlock } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { BLOCK_INSERT_ACTIONS, type BlockInsertAction } from "../block-inserts";
import { buildEditorExtensions } from "../extensions";
import { editorMessages } from "../messages";
import { buildBlockSlashCommands, filterCommands, OPEN_FILE_PICKER_EVENT, SLASH_COMMANDS } from "../slash-command";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

const t = createTranslator(editorMessages);

describe("slash menu insertion driven by block definitions", () => {
	it("builds slash commands for BLOCKS entries with insertable=true and view='node'", () => {
		const commands = buildBlockSlashCommands();

		// mermaid, chart and math must be included.
		const titles = commands.map((c) => c.title);
		expect(titles).toContain("다이어그램");
		expect(titles).toContain("차트");
		expect(titles).toContain("수식");

		// image must be excluded so it does not duplicate the existing hardcoded entry.
		expect(titles).not.toContain("이미지");

		// Blocks with insertable=false or a view other than node must be excluded.
		expect(titles).toContain("콜아웃");
		expect(titles).toContain("탭");
		expect(titles).toContain("단 나누기");
		expect(titles).not.toContain("정렬");

		const mermaidCmd = commands.find((c) => c.title === "다이어그램");
		expect(mermaidCmd?.keywords).toContain("mermaid");
		expect(mermaidCmd?.keywords).toContain("다이어그램");
		expect(mermaidCmd?.description).toBeTruthy();

		const chartCmd = commands.find((c) => c.title === "차트");
		expect(chartCmd?.keywords).toContain("chart");
		expect(chartCmd?.keywords).toContain("차트");
		expect(chartCmd?.description).toBeTruthy();

		const mathCmd = commands.find((c) => c.title === "수식");
		expect(mathCmd?.keywords).toContain("math");
		expect(mathCmd?.keywords).toContain("수식");
		expect(mathCmd?.description).toBeTruthy();
	});

	it("extensibility: adding a new block definition and action to the registry auto-generates a slash command", () => {
		const mockCallout = defineBlock({
			name: "callout",
			label: "콜아웃",
			description: "강조 상자",
			syntax: { kind: "container", directive: "callout" },
			component: "Callout",
			attributes: {},
			editor: {
				view: "node",
				nodeView: "callout",
				insertable: true,
				keywords: ["콜아웃", "callout"],
			},
		});

		const mockAction: BlockInsertAction = vi.fn();
		const actions: Record<string, BlockInsertAction> = {
			...BLOCK_INSERT_ACTIONS,
			callout: mockAction,
		};

		const commands = buildBlockSlashCommands([mockCallout], actions);
		expect(commands).toHaveLength(1);
		expect(commands[0]?.title).toBe(mockCallout.label);
		expect(commands[0]?.description).toBe(mockCallout.description);
		expect(commands[0]?.keywords).toEqual(mockCallout.editor.keywords);
	});

	it("SLASH_COMMANDS includes both the base commands and the auto-generated block commands", () => {
		const titles = SLASH_COMMANDS.map((c) => c.title);
		expect(titles).toEqual(
			expect.arrayContaining([
				t("slash.paragraph.title"),
				t("slash.code.title"),
				t("slash.table.title"),
				t("slash.image.title"),
			]),
		);
		// Tooltip is registered by the blocks extension (`@monti-cms/blocks`), so it is not in the core list.
		expect(SLASH_COMMANDS.some((c) => c.keywords.includes("tooltip"))).toBe(false);
		// Auto-generated block commands carry the block id.
		const ids = SLASH_COMMANDS.map((c) => c.id);
		expect(ids).toEqual(expect.arrayContaining(["mermaid", "chart", "math"]));
	});

	it("slash menu and formatting tools share block names, and the file entry opens the file picker", () => {
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
		window.addEventListener(OPEN_FILE_PICKER_EVENT, open);
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>/파일</p>" });
		SLASH_COMMANDS.find((c) => c.title === t("slash.file.title"))?.action(editor, { from: 1, to: 4 });
		window.removeEventListener(OPEN_FILE_PICKER_EVENT, open);
		expect(open).toHaveBeenCalledOnce();
		expect(editor.getText()).toBe("");
		editor.destroy();
	});

	it("filterCommands searches block commands by Korean and English keywords", () => {
		expect(filterCommands("mermaid").some((c) => c.title === "다이어그램")).toBe(true);
		expect(filterCommands("다이어그램").some((c) => c.title === "다이어그램")).toBe(true);
		expect(filterCommands("chart").some((c) => c.title === "차트")).toBe(true);
		expect(filterCommands("그래프").some((c) => c.title === "차트")).toBe(true);
		expect(filterCommands("math").some((c) => c.title === "수식")).toBe(true);
		expect(filterCommands("katex").some((c) => c.title === "수식")).toBe(true);
		// Tooltip is a text decoration from the blocks extension, so it is not in the core menu; extension-provided entries (`inline`) come after the text formatting entries and before the block entries.
		expect(filterCommands("tooltip").some((c) => c.title === "툴팁")).toBe(false);
		const inline = [{ title: "툴팁", description: "글자에 설명 달기", keywords: ["tooltip"], action: () => {} }];
		expect(filterCommands("tooltip", [], inline).map((c) => c.title)).toEqual(["툴팁"]);
		const titles = filterCommands("", [], inline).map((c) => c.title);
		expect(titles.indexOf("툴팁")).toBeGreaterThan(titles.indexOf("내부 글 링크"));
		expect(titles.indexOf("툴팁")).toBeLessThan(titles.indexOf("다이어그램"));
	});
});

describe("MDX serialization after block insert actions", () => {
	const createEditor = () =>
		new Editor({
			extensions: buildEditorExtensions(),
			content: "<p></p>",
		});

	it("serializes to MDX correctly after inserting mermaid", () => {
		const editor = createEditor();
		const range = { from: 1, to: 1 };

		BLOCK_INSERT_ACTIONS.mermaid(editor, range);

		const serialized = tiptapToMdx(editor.getJSON());
		expect(serialized).toContain("```mermaid");
		expect(serialized).toContain("graph TD");
		expect(serialized).toContain("A --> B");
		editor.destroy();
	});

	it("serializes to MDX correctly after inserting chart", () => {
		const editor = createEditor();
		const range = { from: 1, to: 1 };

		BLOCK_INSERT_ACTIONS.chart(editor, range);

		const serialized = tiptapToMdx(editor.getJSON());
		expect(serialized).toContain("```chart");
		expect(serialized).toContain("chart bar");
		expect(serialized).toContain("x month");
		expect(serialized).toContain("series views");
		editor.destroy();
	});

	it("serializes to MDX correctly after inserting math", () => {
		const editor = createEditor();
		const range = { from: 1, to: 1 };

		BLOCK_INSERT_ACTIONS.math(editor, range);

		const serialized = tiptapToMdx(editor.getJSON());
		expect(serialized).toContain("$$");
		expect(serialized).toContain("E = mc^2");
		editor.destroy();
	});
});

describe("setting, editing and removing a tooltip, and MDX round trip", () => {
	const createEditor = (html = "<p>안녕하세요 세상입니다</p>") =>
		new Editor({
			extensions: buildEditorExtensions(),
			content: html,
		});

	it("round-trips a tooltip label containing a closing bracket by escaping it", () => {
		const editor = createEditor("<p>a]b</p>");
		editor.chain().focus().setTextSelection({ from: 1, to: 4 }).setMark("cmsTooltip", { content: "설명" }).run();
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[a\\]b]{content="설명"}');
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
		editor.destroy();
	});

	it("sets the cmsTooltip mark on the selection and serializes it to MDX", () => {
		const editor = createEditor();
		// Select the "세상" range (pos 7 to 9)
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).run();

		// Apply the tooltip
		editor.chain().focus().setMark("cmsTooltip", { content: "우리가 사는 지구" }).run();

		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("우리가 사는 지구");

		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[세상]{content="우리가 사는 지구"}');
		editor.destroy();
	});

	it("edits the description with extendMarkRange when the cursor is inside a tooltip mark", () => {
		const editor = createEditor();
		// Set the tooltip on the "세상" range
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "기존 설명" }).run();

		// Move the cursor into the middle of the tooltip (pos 8)
		editor.chain().focus().setTextSelection(8).run();
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("기존 설명");

		// Edit the description
		editor.chain().focus().extendMarkRange("cmsTooltip").setMark("cmsTooltip", { content: "업데이트된 설명" }).run();

		expect(editor.getAttributes("cmsTooltip").content).toBe("업데이트된 설명");
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[세상]{content="업데이트된 설명"}');
		editor.destroy();
	});

	it("removes the tooltip with extendMarkRange when the cursor is inside a tooltip mark", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "삭제될 설명" }).run();

		// Move the cursor into the middle of the tooltip, then remove it
		editor.chain().focus().setTextSelection(8).extendMarkRange("cmsTooltip").unsetMark("cmsTooltip").run();

		expect(editor.isActive("cmsTooltip")).toBe(false);
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).not.toContain(":tooltip");
		expect(mdx).toContain("세상");
		editor.destroy();
	});

	it("loads :tooltip syntax from MDX into the editor and round-trips it losslessly on re-serialization", () => {
		const initialMdx = '본문 속 :tooltip[단어]{content="상세 설명"} 확인하기\n';
		const json = mdxToTiptap(initialMdx);

		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: json,
		});

		expect(editor.isActive("cmsTooltip")).toBe(false);
		// Move the cursor onto the word
		editor.chain().focus().setTextSelection(7).run();
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("상세 설명");

		const roundtripMdx = tiptapToMdx(editor.getJSON());
		expect(roundtripMdx).toBe(initialMdx);
		editor.destroy();
	});
});

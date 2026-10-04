import { defineBlock } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { BLOCK_INSERT_ACTIONS, type BlockInsertAction } from "../block-inserts";
import { buildEditorExtensions } from "../extensions";
import { buildBlockSlashCommands, filterCommands, OPEN_FILE_PICKER_EVENT, SLASH_COMMANDS } from "../slash-command";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

describe("슬래시 메뉴 블록 정의 기반 삽입 (v2 C3a)", () => {
	it("블록 정의(BLOCKS) 중 insertable=true, view='node'인 항목의 슬래시 커맨드를 생성한다", () => {
		const commands = buildBlockSlashCommands();

		// mermaid, chart, math가 포함되어야 한다.
		const titles = commands.map((c) => c.title);
		expect(titles).toContain("다이어그램");
		expect(titles).toContain("차트");
		expect(titles).toContain("수식");

		// 이미지는 기존 하드코딩 항목과 중복되지 않도록 제외되어야 한다.
		expect(titles).not.toContain("이미지");

		// insertable이 false이거나 view가 node가 아닌 블록은 제외되어야 한다.
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

	it("C3b 확장성: 새 블록 정의와 액션을 등록부에 추가하면 슬래시 커맨드가 자동 생성된다", () => {
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
		expect(commands[0]?.title).toBe("콜아웃");
		expect(commands[0]?.description).toBe("강조 상자");
		expect(commands[0]?.keywords).toEqual(["콜아웃", "callout"]);
	});

	it("SLASH_COMMANDS에 기본 커맨드와 자동 생성 블록 커맨드가 모두 포함된다", () => {
		const titles = SLASH_COMMANDS.map((c) => c.title);
		expect(titles).toContain("문단");
		expect(titles).toContain("코드 블록");
		expect(titles).toContain("표");
		expect(titles).toContain("이미지");
		// 툴팁은 블록 확장(`@monti-cms/blocks`)이 등록하는 항목이라 본체 목록에 없다.
		expect(titles).not.toContain("툴팁");
		expect(titles).toContain("다이어그램");
		expect(titles).toContain("차트");
		expect(titles).toContain("수식");
	});

	it("슬래시 메뉴와 서식 도구가 같은 블록 이름을 쓰고, 파일 항목은 파일 고르기를 연다", () => {
		const titles = SLASH_COMMANDS.map((c) => c.title);
		expect(titles).toEqual(expect.arrayContaining(["문단", "글머리 목록", "번호 목록", "코드 블록", "표", "파일"]));
		const open = vi.fn();
		window.addEventListener(OPEN_FILE_PICKER_EVENT, open);
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>/파일</p>" });
		SLASH_COMMANDS.find((c) => c.title === "파일")?.action(editor, { from: 1, to: 4 });
		window.removeEventListener(OPEN_FILE_PICKER_EVENT, open);
		expect(open).toHaveBeenCalledOnce();
		expect(editor.getText()).toBe("");
		editor.destroy();
	});

	it("filterCommands가 한글/영문 키워드로 블록 커맨드를 검색한다", () => {
		expect(filterCommands("mermaid").some((c) => c.title === "다이어그램")).toBe(true);
		expect(filterCommands("다이어그램").some((c) => c.title === "다이어그램")).toBe(true);
		expect(filterCommands("chart").some((c) => c.title === "차트")).toBe(true);
		expect(filterCommands("그래프").some((c) => c.title === "차트")).toBe(true);
		expect(filterCommands("math").some((c) => c.title === "수식")).toBe(true);
		expect(filterCommands("katex").some((c) => c.title === "수식")).toBe(true);
		// 툴팁은 블록 확장의 글자 꾸밈이라 본체 메뉴에 없고, 확장이 준 항목(`inline`)은 글 서식 항목 다음·블록 항목 앞에 온다.
		expect(filterCommands("tooltip").some((c) => c.title === "툴팁")).toBe(false);
		const inline = [{ title: "툴팁", description: "글자에 설명 달기", keywords: ["tooltip"], action: () => {} }];
		expect(filterCommands("tooltip", [], inline).map((c) => c.title)).toEqual(["툴팁"]);
		const titles = filterCommands("", [], inline).map((c) => c.title);
		expect(titles.indexOf("툴팁")).toBeGreaterThan(titles.indexOf("내부 글 링크"));
		expect(titles.indexOf("툴팁")).toBeLessThan(titles.indexOf("다이어그램"));
	});
});

describe("블록 삽입 액션 후 MDX 직렬화 (v2 C3a)", () => {
	const createEditor = () =>
		new Editor({
			extensions: buildEditorExtensions(),
			content: "<p></p>",
		});

	it("mermaid 삽입 후 MDX로 올바르게 직렬화된다", () => {
		const editor = createEditor();
		const range = { from: 1, to: 1 };

		BLOCK_INSERT_ACTIONS.mermaid(editor, range);

		const serialized = tiptapToMdx(editor.getJSON());
		expect(serialized).toContain("```mermaid");
		expect(serialized).toContain("graph TD");
		expect(serialized).toContain("A --> B");
		editor.destroy();
	});

	it("chart 삽입 후 MDX로 올바르게 직렬화된다", () => {
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

	it("math 삽입 후 MDX로 올바르게 직렬화된다", () => {
		const editor = createEditor();
		const range = { from: 1, to: 1 };

		BLOCK_INSERT_ACTIONS.math(editor, range);

		const serialized = tiptapToMdx(editor.getJSON());
		expect(serialized).toContain("$$");
		expect(serialized).toContain("E = mc^2");
		editor.destroy();
	});
});

describe("툴팁(Tooltip) 설정·수정·제거 및 MDX 왕복 (v2 C3a)", () => {
	const createEditor = (html = "<p>안녕하세요 세상입니다</p>") =>
		new Editor({
			extensions: buildEditorExtensions(),
			content: html,
		});

	it("닫는 대괄호가 포함된 툴팁 라벨을 이스케이프해 왕복한다", () => {
		const editor = createEditor("<p>a]b</p>");
		editor.chain().focus().setTextSelection({ from: 1, to: 4 }).setMark("cmsTooltip", { content: "설명" }).run();
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[a\\]b]{content="설명"}');
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
		editor.destroy();
	});

	it("선택 영역에 cmsTooltip 마크를 설정하고 MDX로 직렬화한다", () => {
		const editor = createEditor();
		// "세상" 영역 선택 (pos 7 ~ 9)
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).run();

		// 툴팁 적용
		editor.chain().focus().setMark("cmsTooltip", { content: "우리가 사는 지구" }).run();

		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("우리가 사는 지구");

		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[세상]{content="우리가 사는 지구"}');
		editor.destroy();
	});

	it("커서가 툴팁 마크 안일 때 extendMarkRange로 설명을 수정한다", () => {
		const editor = createEditor();
		// "세상" 영역에 툴팁 설정
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "기존 설명" }).run();

		// 커서를 툴팁 중간(pos 8)으로 이동
		editor.chain().focus().setTextSelection(8).run();
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("기존 설명");

		// 설명 수정
		editor.chain().focus().extendMarkRange("cmsTooltip").setMark("cmsTooltip", { content: "업데이트된 설명" }).run();

		expect(editor.getAttributes("cmsTooltip").content).toBe("업데이트된 설명");
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).toContain(':tooltip[세상]{content="업데이트된 설명"}');
		editor.destroy();
	});

	it("커서가 툴팁 마크 안일 때 extendMarkRange로 툴팁을 제거한다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "삭제될 설명" }).run();

		// 커서를 툴팁 중간으로 이동 후 제거
		editor.chain().focus().setTextSelection(8).extendMarkRange("cmsTooltip").unsetMark("cmsTooltip").run();

		expect(editor.isActive("cmsTooltip")).toBe(false);
		const mdx = tiptapToMdx(editor.getJSON());
		expect(mdx).not.toContain(":tooltip");
		expect(mdx).toContain("세상");
		editor.destroy();
	});

	it("MDX의 :tooltip 문법을 에디터로 적재하고 재직렬화 시 손실 없이 왕복한다", () => {
		const initialMdx = '본문 속 :tooltip[단어]{content="상세 설명"} 확인하기\n';
		const json = mdxToTiptap(initialMdx);

		const editor = new Editor({
			extensions: buildEditorExtensions(),
			content: json,
		});

		expect(editor.isActive("cmsTooltip")).toBe(false);
		// 단어 위치로 커서 이동
		editor.chain().focus().setTextSelection(7).run();
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("상세 설명");

		const roundtripMdx = tiptapToMdx(editor.getJSON());
		expect(roundtripMdx).toBe(initialMdx);
		editor.destroy();
	});
});

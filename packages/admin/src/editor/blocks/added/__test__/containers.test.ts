import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { Editor } from "@tiptap/core";
import { DOMParser as PmDOMParser } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { deleteBlock, duplicateBlock } from "../../../block-commands";
import { BLOCK_INSERT_ACTIONS } from "../../../block-inserts";
import { buildEditorExtensions } from "../../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../../tiptap-content";

const sources = [
	':::callout{variant="note"}\n\n강조 **문장**\n\n:::',
	':::collapsible{title="제목"}\n\n본문\n\n:::',
	'::::tabs\n:::tab{label="a"}\n첫째\n:::\n:::tab{label="b"}\n둘째\n:::\n::::',
	"::::columns\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::",
	'::::columns{widths="60,40"}\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::',
];

describe("C3 컨테이너 본문 편집", () => {
	it.each(
		sources.map(
			(source, index) =>
				[source, ["cmsCallout", "cmsCollapsible", "cmsTabs", "cmsColumns", "cmsColumns"][index]] as const,
		),
	)("MDX → Tiptap 스키마 → MDX 왕복: %s", (source, expected) => {
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.type).toBe(expected);
		const editor = new Editor({ extensions: buildEditorExtensions(), content });
		const saved = tiptapToMdx(editor.getJSON()).trim();
		// 직렬화기는 컨테이너 내부 여백을 정규화한다. 편집기를 거친 결과가 같은 정본이어야 한다.
		expect(saved).toBe(serialize(toDocument(analyze(source))).trim());
		editor.destroy();
	});

	it.each(["callout", "collapsible", "tabs", "columns"])("슬래시로 %s 기본 구조를 넣는다", (name) => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>/</p>" });
		BLOCK_INSERT_ACTIONS[name]?.(editor, { from: 1, to: 2 });
		expect(editor.getJSON().content?.[0]?.type).toBe(`cms${name[0]?.toUpperCase()}${name.slice(1)}`);
		expect(tiptapToMdx(editor.getJSON())).toContain(`:${name}`);
		editor.destroy();
	});

	it("HTML 복사·붙여넣기도 컨테이너 속성을 잃지 않는다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[0] ?? "") });
		const html = editor.getHTML();
		const element = document.createElement("div");
		element.innerHTML = html;
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.variant).toBe("note");
		expect(parsed.firstChild?.attrs.originalAttributes).toEqual(editor.state.doc.firstChild?.attrs.originalAttributes);
		editor.destroy();
	});

	it("긴 제목도 HTML 복사·붙여넣기에서 보존한다", () => {
		const title = "긴 제목".repeat(5000);
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[0] ?? "") });
		editor.commands.updateAttributes("cmsCallout", { values: { title } });
		const element = document.createElement("div");
		element.innerHTML = editor.getHTML();
		const parsed = PmDOMParser.fromSchema(editor.schema).parse(element);
		expect(parsed.firstChild?.attrs.values.title).toBe(title);
		editor.destroy();
	});

	it("본문 없는 콜아웃은 빈 문단으로 열고, 비운 채 저장하면 본문 없이 되돌린다", () => {
		const source = ':::callout{variant="info" title="제목만"}\n:::';
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.type).toBe("cmsCallout");
		expect(content.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
		const editor = new Editor({ extensions: buildEditorExtensions(), content });
		expect(tiptapToMdx(editor.getJSON()).trim()).toBe(serialize(toDocument(analyze(source))).trim());
		editor.commands.insertContentAt(2, "새 본문");
		expect(tiptapToMdx(editor.getJSON())).toContain("새 본문");
		editor.destroy();
	});

	it("빈 컨테이너(콜아웃 제외)와 부모 바깥의 Tab은 원문 보존 상자로 간다", () => {
		const empty = mdxToTiptap(':::collapsible{title="a"}\n:::');
		expect(empty.content?.[0]?.type).not.toBe("cmsCollapsible");
		const orphan = mdxToTiptap(':::tab{label="a"}\n본문\n:::');
		expect(orphan.content?.[0]?.type).not.toBe("cmsTab");
		const loneColumn = mdxToTiptap(":::column\n본문\n:::");
		expect(loneColumn.content?.[0]?.type).not.toBe("cmsColumn");
		const invalid = mdxToTiptap(':::callout\n:::tab{label="a"}\n본문\n:::\n:::');
		expect(invalid.content?.[0]?.type).not.toBe("cmsCallout");
	});

	it("핸들 명령으로 Tab 최소·최대 수 제한을 우회하지 못한다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(sources[2] ?? "") });
		expect(deleteBlock(editor, 1)).toBe(false);
		let pos = 0;
		for (let i = 0; i < 6; i++) {
			const tab = editor.state.doc.firstChild?.child(i);
			if (!tab) break;
			pos =
				1 +
				Array.from({ length: i }, (_, idx) => editor.state.doc.firstChild?.child(idx).nodeSize ?? 0).reduce(
					(a, b) => a + b,
					0,
				);
			expect(duplicateBlock(editor, pos)).toBe(i < 6);
		}
		expect(editor.state.doc.firstChild?.childCount).toBe(8);
		expect(duplicateBlock(editor, 1)).toBe(false);
		editor.destroy();
	});

	it("탭 두 개·단 두 개 미만은 스키마가 거부한다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: "<p>시작</p>" });
		const tab = editor.schema.nodes.cmsTab;
		const column = editor.schema.nodes.cmsColumn;
		expect(tab).toBeDefined();
		expect(column).toBeDefined();
		if (!tab || !column) throw new Error("컨테이너 자식 노드 누락");
		expect(editor.schema.nodes.cmsTabs?.contentMatch.matchType(tab)?.validEnd).toBe(false);
		expect(editor.schema.nodes.cmsColumns?.contentMatch.matchType(column)?.validEnd).toBe(false);
		editor.destroy();
	});
});

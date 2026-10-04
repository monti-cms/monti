import { Editor } from "@tiptap/core";
import { CellSelection, cellAround } from "@tiptap/pm/tables";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "../tiptap-schema";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const createTableEditor = (content: ReturnType<typeof mdxToTiptap>) => {
	editor = new Editor({
		extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }), ...CMS_SCHEMA_EXTENSIONS],
		content,
	});
	return editor;
};

describe("C6 편집기 표 셀 병합 및 분할", () => {
	it("병합 표 MDX를 로드하여 Tiptap 스키마에서 colspan/rowspan을 보존한다", () => {
		const source = [
			'::::table{align="left,center"}',
			":::row",
			"::cell[머리글]{header colspan=2}",
			":::",
			":::row",
			"::cell[내용1]{rowspan=2}",
			"::cell[내용2]",
			":::",
			":::row",
			"::cell[내용3]",
			":::",
			"::::",
		].join("\n");

		const instance = createTableEditor(mdxToTiptap(source));
		const json = instance.getJSON();
		const table = json.content?.[0];
		expect(table?.type).toBe("table");

		const row0 = table?.content?.[0] as typeof table;
		const cell0 = row0?.content?.[0] as typeof table;
		expect(cell0?.attrs?.colspan).toBe(2);

		const row1 = table?.content?.[1] as typeof table;
		const cell1 = row1?.content?.[0] as typeof table;
		expect(cell1?.attrs?.rowspan).toBe(2);

		expect(tiptapToMdx(json).trim()).toBe(source);
	});

	it("GFM 표에서 셀을 병합(mergeCells)하면 지시자 표로 직렬화된다", () => {
		const gfm = ["| a | b |", "| :-- | :-: |", "| 1 | 2 |"].join("\n");

		const instance = createTableEditor(mdxToTiptap(gfm));

		// 셀 선택(CellSelection)을 설정한다
		const doc = instance.state.doc;
		const tableNode = doc.firstChild;
		expect(tableNode?.type.name).toBe("table");

		// 첫 행의 두 셀(a와 b)을 CellSelection으로 선택
		let cell1Pos: number | null = null;
		let cell2Pos: number | null = null;

		doc.descendants((node, pos) => {
			if (node.type.name === "tableHeader" || node.type.name === "tableCell") {
				if (cell1Pos === null) cell1Pos = pos;
				else if (cell2Pos === null) cell2Pos = pos;
			}
		});

		expect(cell1Pos).not.toBeNull();
		expect(cell2Pos).not.toBeNull();

		if (cell1Pos === null || cell2Pos === null) {
			throw new Error("셀 위치를 찾을 수 없습니다.");
		}
		const c1 = cellAround(doc.resolve(cell1Pos + 1));
		const c2 = cellAround(doc.resolve(cell2Pos + 1));
		if (!c1 || !c2) {
			throw new Error("셀 노드를 찾을 수 없습니다.");
		}
		const cellSelection = new CellSelection(c1, c2);

		instance.view.dispatch(instance.state.tr.setSelection(cellSelection));
		expect(instance.state.selection instanceof CellSelection).toBe(true);

		// 셀 병합 실행
		const merged = instance.commands.mergeCells();
		expect(merged).toBe(true);

		const resultMdx = tiptapToMdx(instance.getJSON()).trim();
		expect(resultMdx).toContain("::::table");
		expect(resultMdx).toContain("colspan=2");
	});

	it("병합된 셀을 나누면(splitCell) 다시 GFM 표로 복귀한다", () => {
		const source = [
			'::::table{align="left,center"}',
			":::row",
			"::cell[제목]{header colspan=2}",
			":::",
			":::row",
			"::cell[1]",
			"::cell[2]",
			":::",
			"::::",
		].join("\n");

		const instance = createTableEditor(mdxToTiptap(source));
		const doc = instance.state.doc;

		// 병합된 첫 셀을 CellSelection으로 선택
		let firstCellPos: number | null = null;
		doc.descendants((node, pos) => {
			if (firstCellPos === null && (node.type.name === "tableHeader" || node.type.name === "tableCell")) {
				firstCellPos = pos;
			}
		});

		expect(firstCellPos).not.toBeNull();
		if (firstCellPos === null) {
			throw new Error("첫 번째 셀 위치를 찾을 수 없습니다.");
		}
		const c = cellAround(doc.resolve(firstCellPos + 1));
		if (!c) {
			throw new Error("셀 노드를 찾을 수 없습니다.");
		}
		const cellSelection = new CellSelection(c);
		instance.view.dispatch(instance.state.tr.setSelection(cellSelection));

		// 셀 나누기 실행
		const split = instance.commands.splitCell();
		expect(split).toBe(true);

		const resultMdx = tiptapToMdx(instance.getJSON()).trim();
		// 병합이 모두 풀렸으므로 GFM 표로 복귀
		expect(resultMdx).not.toContain("::::table");
		expect(resultMdx).toContain("| 제목 |");
	});

	it("선택이 CellSelection이 아닐 때는 mergeCells 및 splitCell이 불가 상태여야 한다", () => {
		const gfm = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");

		const instance = createTableEditor(mdxToTiptap(gfm));
		// 기본 커서 선택 상태 (TextSelection)
		expect(instance.state.selection instanceof CellSelection).toBe(false);
	});

	it("병합을 풀어도 첫 열 머리글 배치를 첫 행 머리글로 바꾸지 않는다", () => {
		const source = [
			"::::table",
			":::row",
			"::cell[이름]{header}",
			"::cell[값]",
			":::",
			":::row",
			"::cell[나이]{header}",
			"::cell[3]",
			":::",
			"::::",
		].join("\n");
		expect(tiptapToMdx(mdxToTiptap(source)).trim()).toBe(source);
	});

	it("열 너비를 셀 colwidth로 불러오고 조절한 너비를 widths로 저장한다", () => {
		const source = [
			'::::table{widths="80,160"}',
			":::row",
			"::cell[합친 머리글]{header colspan=2}",
			":::",
			":::row",
			"::cell[a]",
			"::cell[b]",
			":::",
			"::::",
		].join("\n");
		const json = mdxToTiptap(source);
		const firstRow = json.content?.[0]?.content?.[0];
		const secondRow = json.content?.[0]?.content?.[1];
		expect(firstRow?.content?.[0]?.attrs?.colwidth).toEqual([80, 160]);
		expect(secondRow?.content?.[1]?.attrs?.colwidth).toEqual([160]);
		expect(tiptapToMdx(json).trim()).toBe(source);

		// 병합 없는 GFM 표에서 열 너비를 조절하면 머리글을 명시한 directive 표로 저장한다.
		const gfm = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
		const instance = createTableEditor(mdxToTiptap(gfm));
		instance.commands.setTextSelection(3);
		instance.commands.setCellAttribute("colwidth", [150]);
		expect(tiptapToMdx(instance.getJSON()).trim()).toBe(
			[
				'::::table{widths="150"}',
				":::row",
				"::cell[a]{header}",
				"::cell[b]{header}",
				":::",
				":::row",
				"::cell[1]",
				"::cell[2]",
				":::",
				"::::",
			].join("\n"),
		);
	});
});

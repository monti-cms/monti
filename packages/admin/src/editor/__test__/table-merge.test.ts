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

describe("editor table cell merge and split", () => {
	it("loading merged-table MDX preserves colspan/rowspan in the Tiptap schema", () => {
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

	it("merging cells (mergeCells) in a GFM table serializes it as a directive table", () => {
		const gfm = ["| a | b |", "| :-- | :-: |", "| 1 | 2 |"].join("\n");

		const instance = createTableEditor(mdxToTiptap(gfm));

		// set the cell selection (CellSelection)
		const doc = instance.state.doc;
		const tableNode = doc.firstChild;
		expect(tableNode?.type.name).toBe("table");

		// select the two cells of the first row (a and b) with a CellSelection
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
			throw new Error("Cell position not found.");
		}
		const c1 = cellAround(doc.resolve(cell1Pos + 1));
		const c2 = cellAround(doc.resolve(cell2Pos + 1));
		if (!c1 || !c2) {
			throw new Error("Cell node not found.");
		}
		const cellSelection = new CellSelection(c1, c2);

		instance.view.dispatch(instance.state.tr.setSelection(cellSelection));
		expect(instance.state.selection instanceof CellSelection).toBe(true);

		// run cell merge
		const merged = instance.commands.mergeCells();
		expect(merged).toBe(true);

		const resultMdx = tiptapToMdx(instance.getJSON()).trim();
		expect(resultMdx).toContain("::::table");
		expect(resultMdx).toContain("colspan=2");
	});

	it("splitting a merged cell (splitCell) returns the table to GFM", () => {
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

		// select the merged first cell with a CellSelection
		let firstCellPos: number | null = null;
		doc.descendants((node, pos) => {
			if (firstCellPos === null && (node.type.name === "tableHeader" || node.type.name === "tableCell")) {
				firstCellPos = pos;
			}
		});

		expect(firstCellPos).not.toBeNull();
		if (firstCellPos === null) {
			throw new Error("First cell position not found.");
		}
		const c = cellAround(doc.resolve(firstCellPos + 1));
		if (!c) {
			throw new Error("Cell node not found.");
		}
		const cellSelection = new CellSelection(c);
		instance.view.dispatch(instance.state.tr.setSelection(cellSelection));

		// run cell split
		const split = instance.commands.splitCell();
		expect(split).toBe(true);

		const resultMdx = tiptapToMdx(instance.getJSON()).trim();
		// all merges are undone, so it returns to a GFM table
		expect(resultMdx).not.toContain("::::table");
		expect(resultMdx).toContain("| 제목 |");
	});

	it("mergeCells and splitCell must be unavailable when the selection is not a CellSelection", () => {
		const gfm = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");

		const instance = createTableEditor(mdxToTiptap(gfm));
		// default cursor selection (TextSelection)
		expect(instance.state.selection instanceof CellSelection).toBe(false);
	});

	it("undoing a merge does not turn a first-column header layout into a first-row header", () => {
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

	it("loads column widths as cell colwidth and saves adjusted widths as widths", () => {
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

		// Adjusting column widths in a GFM table without merges saves it as a directive table with the header made explicit.
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

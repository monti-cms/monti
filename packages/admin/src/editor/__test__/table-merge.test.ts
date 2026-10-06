import { Editor } from "@tiptap/core";
import { CellSelection, cellAround } from "@tiptap/pm/tables";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { storedDoc, table, text, withoutIds } from "../../test/stored-doc";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "../tiptap-schema";

/** The table cells a stored document holds, row by row. */
const cellsOf = (doc: ReturnType<typeof tiptapToStored>) =>
	(doc.content[0]?.content ?? []).map((row) => row.content ?? []);
const gfmTable = () =>
	storedDoc(
		table(
			[
				[[text("a")], [text("b")]],
				[[text("1")], [text("2")]],
			],
			{ align: ["left", "center"] },
		),
	);
const mergedTable = () =>
	storedDoc(
		table(
			[
				[{ attrs: { header: true, colspan: 2 }, content: [text("머리글")] }],
				[{ attrs: { rowspan: 2 }, content: [text("내용1")] }, [text("내용2")]],
				[[text("내용3")]],
			],
			{ align: ["left", "center"] },
		),
	);

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const createTableEditor = (content: ReturnType<typeof storedToTiptap>) => {
	editor = new Editor({
		extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }), ...CMS_SCHEMA_EXTENSIONS],
		content,
	});
	return editor;
};

describe("editor table cell merge and split", () => {
	it("loading a merged table preserves colspan/rowspan in the Tiptap schema", () => {
		const source = mergedTable();

		const instance = createTableEditor(storedToTiptap(source));
		const json = instance.getJSON();
		const table = json.content?.[0];
		expect(table?.type).toBe("table");

		const row0 = table?.content?.[0] as typeof table;
		const cell0 = row0?.content?.[0] as typeof table;
		expect(cell0?.attrs?.colspan).toBe(2);

		const row1 = table?.content?.[1] as typeof table;
		const cell1 = row1?.content?.[0] as typeof table;
		expect(cell1?.attrs?.rowspan).toBe(2);

		expect(withoutIds(tiptapToStored(json))).toEqual(withoutIds(source));
	});

	it("merging cells (mergeCells) in a GFM table saves a table with a merged cell", () => {
		const instance = createTableEditor(storedToTiptap(gfmTable()));

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

		const saved = tiptapToStored(instance.getJSON());
		expect(saved.content[0]?.type).toBe("table");
		expect(
			cellsOf(saved)
				.flat()
				.map((cell) => cell.attrs?.colspan),
		).toContain(2);
	});

	it("splitting a merged cell (splitCell) returns the table to GFM", () => {
		const source = storedDoc(
			table([[{ attrs: { header: true, colspan: 2 }, content: [text("제목")] }], [[text("1")], [text("2")]]], {
				align: ["left", "center"],
			}),
		);

		const instance = createTableEditor(storedToTiptap(source));
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

		const saved = tiptapToStored(instance.getJSON());
		// all merges are undone, so it returns to a GFM table: no spans and no explicit header cells
		const cells = cellsOf(saved).flat();
		expect(cells.some((cell) => cell.attrs?.colspan !== undefined || cell.attrs?.rowspan !== undefined)).toBe(false);
		expect(cells.some((cell) => cell.attrs?.header !== undefined)).toBe(false);
		expect(JSON.stringify(cells[0])).toContain("제목");
	});

	it("mergeCells and splitCell must be unavailable when the selection is not a CellSelection", () => {
		const instance = createTableEditor(storedToTiptap(gfmTable()));
		// default cursor selection (TextSelection)
		expect(instance.state.selection instanceof CellSelection).toBe(false);
	});

	it("undoing a merge does not turn a first-column header layout into a first-row header", () => {
		const source = storedDoc(
			table([
				[
					{ attrs: { header: true }, content: [text("이름")] },
					{ attrs: { header: false }, content: [text("값")] },
				],
				[
					{ attrs: { header: true }, content: [text("나이")] },
					{ attrs: { header: false }, content: [text("3")] },
				],
			]),
		);
		const saved = tiptapToStored(storedToTiptap(source));
		expect(withoutIds(saved)).toEqual(withoutIds(source));
		expect(cellsOf(saved).map((row) => row.map((cell) => cell.attrs?.header))).toEqual([
			[true, false],
			[true, false],
		]);
	});

	it("loads column widths as cell colwidth and saves adjusted widths as widths", () => {
		const source = storedDoc(
			table([[{ attrs: { header: true, colspan: 2 }, content: [text("합친 머리글")] }], [[text("a")], [text("b")]]], {
				widths: [80, 160],
			}),
		);
		const json = storedToTiptap(source);
		const firstRow = json.content?.[0]?.content?.[0];
		const secondRow = json.content?.[0]?.content?.[1];
		expect(firstRow?.content?.[0]?.attrs?.colwidth).toEqual([80, 160]);
		expect(secondRow?.content?.[1]?.attrs?.colwidth).toEqual([160]);
		expect(withoutIds(tiptapToStored(json))).toEqual(withoutIds(source));

		// Adjusting column widths in a GFM table without merges saves a table with widths and the header made explicit.
		const instance = createTableEditor(storedToTiptap(gfmTable()));
		instance.commands.setTextSelection(3);
		instance.commands.setCellAttribute("colwidth", [150]);
		const saved = tiptapToStored(instance.getJSON());
		expect(saved.content[0]?.attrs?.widths).toEqual([150]);
		expect(cellsOf(saved).map((row) => row.map((cell) => cell.attrs?.header))).toEqual([
			[true, true],
			[undefined, undefined],
		]);
	});
});

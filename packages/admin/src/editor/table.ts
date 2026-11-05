import type { Block } from "@monti-cms/core";
import type { JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { Node as EditorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/**
 * The table block in the editor (T62): Tiptap's table, whose cells hold plain text (doc 03 decisions: a table's cells are plain text, `attrs.rows`).
 * Its rows, head row and column widths are stored on the block (`rows`, `header`, `widths`), never the engine's own shape.
 */

/** The body's width (`--monti-width-reading`): a column's stored share of the body becomes pixels here, and back. */
const BODY_WIDTH = 680;
/** The narrowest a column can be dragged. */
export const CELL_MIN_WIDTH = 48;

/** Cells hold plain text: no marks, no blocks, so a cell is what `attrs.rows` keeps. */
const plainCell = { content: "text*", marks: "" } as const;

export const tableExtensions = () => [
	Table.extend({
		addAttributes: () => ({
			blockId: { default: null, keepOnSplit: false, rendered: false },
			data: { default: null, rendered: false },
		}),
	}).configure({
		resizable: true,
		cellMinWidth: CELL_MIN_WIDTH,
		lastColumnResizable: true,
		allowTableNodeSelection: false,
	}),
	TableRow,
	TableHeader.extend(plainCell),
	TableCell.extend(plainCell),
];

const cellText = (cell: JSONContent) => (cell.content ?? []).map((part) => part.text ?? "").join("");

/** A stored table as the editor's nodes: the head row's cells are header cells, and each column keeps its width in pixels. */
export function tableToEditor(block: Block, id: string | null): JSONContent {
	const {
		rows = [],
		header = false,
		widths,
	} = (block.attrs ?? {}) as {
		rows?: string[][];
		header?: boolean;
		widths?: number[];
	};
	const columns = Math.max(1, ...rows.map((row) => row.length));
	const grid = rows.length ? rows : [Array.from({ length: columns }, () => "")];
	// The cells' 1px borders take their room from the body too, so a table of shares is never wider than the body.
	const room = BODY_WIDTH - (columns + 1);
	const pixels = widths?.length === columns ? widths.map((share) => Math.floor((share / 100) * room)) : null;
	return {
		type: "table",
		attrs: { blockId: id, data: null },
		content: grid.map((row, rowIndex) => ({
			type: "tableRow",
			content: Array.from({ length: columns }, (_, column) => {
				const text = row[column] ?? "";
				return {
					type: header && rowIndex === 0 ? "tableHeader" : "tableCell",
					attrs: { colspan: 1, rowspan: 1, colwidth: pixels ? [pixels[column]] : null },
					...(text ? { content: [{ type: "text", text }] } : {}),
				};
			}),
		})),
	};
}

/**
 * The editor's table as it is stored. Widths are kept only once a column was dragged: the columns left to the table share the rest of the body, and
 * every column is stored as its share, so the site narrows the table with the page.
 */
export function tableFromEditor(node: JSONContent): Block {
	const rows = (node.content ?? []).map((row) => (row.content ?? []).map(cellText));
	const first = node.content?.[0]?.content ?? [];
	const header = first.length > 0 && first.every((cell) => cell.type === "tableHeader");
	const set = first.map((cell) => {
		const width = (cell.attrs?.colwidth as number[] | null | undefined)?.[0];
		return typeof width === "number" && width > 0 ? width : null;
	});
	const attrs: Record<string, unknown> = { rows };
	if (header) attrs.header = true;
	if (set.some((width) => width !== null)) {
		const fixed = set.reduce<number>((sum, width) => sum + (width ?? 0), 0);
		const open = set.filter((width) => width === null).length;
		const rest = open ? Math.max(CELL_MIN_WIDTH, (BODY_WIDTH - (set.length + 1) - fixed) / open) : 0;
		const pixels = set.map((width) => width ?? rest);
		const total = pixels.reduce((sum, width) => sum + width, 0);
		attrs.widths = pixels.map((width) => Math.round((width / total) * 1000) / 10);
	}
	return { id: String(node.attrs?.blockId ?? ""), type: "table", attrs };
}

/** Whether a table's first row is its head row. */
export const hasHeaderRow = (table: EditorNode) => {
	const first = table.firstChild;
	return Boolean(first?.childCount) && first?.content.content.every((cell) => cell.type.name === "tableHeader");
};

/** Turns a table's first row into its head row, or back into a plain row. */
export function toggleHeaderRow(tr: Transaction, tablePos: number) {
	const table = tr.doc.nodeAt(tablePos);
	const first = table?.firstChild;
	if (!table || !first) return;
	const on = !hasHeaderRow(table);
	const type = tr.doc.type.schema.nodes[on ? "tableHeader" : "tableCell"];
	if (!type) return;
	let pos = tablePos + 2;
	first.forEach((cell) => {
		tr.setNodeMarkup(pos, type, cell.attrs);
		pos += cell.nodeSize;
	});
}

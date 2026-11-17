import type { Block } from "@monti-cms/core";
import type { JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import type { Node as EditorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";

/**
 * The table block in the editor (T62): Tiptap's table, whose cells hold plain text (doc 03 decisions: a table's cells are plain text, `attrs.rows`).
 * A table is always as wide as the body (2026-11-06 owner, as Google Docs): its columns' widths are shares of it (`attrs.widths`, in percent), kept
 * on the table node itself. Adding a column takes its room from the others; dragging a border trades width between the two columns beside it.
 */

/** The narrowest share a column can be given (about 48px of the 680px body). */
export const MIN_SHARE = 7;

/** Cells hold plain text: no marks, no blocks, so a cell is what `attrs.rows` keeps. */
const plainCell = { content: "text*", marks: "" } as const;

const sharesOf = (node: EditorNode): number[] | null => {
	const widths = node.attrs.data?.widths as number[] | undefined;
	return widths?.length === TableMap.get(node).width ? widths : null;
};

export const tableExtensions = () => [
	Table.extend({
		addAttributes: () => ({
			blockId: { default: null, keepOnSplit: false, rendered: false },
			data: { default: null, rendered: false },
		}),
		// The body's width, the columns at their shares (or even, until a border is dragged).
		renderHTML: ({ node }) => {
			const shares = sharesOf(node);
			return [
				"table",
				{},
				[
					"colgroup",
					...Array.from({ length: TableMap.get(node).width }, (_, at) => [
						"col",
						shares ? { style: `width: ${shares[at]}%` } : {},
					]),
				],
				["tbody", 0],
			];
		},
		// No view of its own: the table is drawn from `renderHTML` above, so its widths are the shares.
	}).configure({ resizable: false, View: null, allowTableNodeSelection: false }),
	TableRow,
	TableHeader.extend(plainCell),
	TableCell.extend(plainCell),
];

const cellText = (cell: JSONContent) => (cell.content ?? []).map((part) => part.text ?? "").join("");

/** A stored table as the editor's nodes: the head row's cells are header cells, and the widths stay on the table. */
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
	return {
		type: "table",
		attrs: { blockId: id, data: widths?.length === columns ? { widths } : null },
		content: grid.map((row, rowIndex) => ({
			type: "tableRow",
			content: Array.from({ length: columns }, (_, column) => {
				const text = row[column] ?? "";
				return {
					type: header && rowIndex === 0 ? "tableHeader" : "tableCell",
					...(text ? { content: [{ type: "text", text }] } : {}),
				};
			}),
		})),
	};
}

/** The editor's table as it is stored. Widths are kept only once a border was dragged. */
export function tableFromEditor(node: JSONContent): Block {
	const rows = (node.content ?? []).map((row) => (row.content ?? []).map(cellText));
	const first = node.content?.[0]?.content ?? [];
	const header = first.length > 0 && first.every((cell) => cell.type === "tableHeader");
	const widths = (node.attrs?.data as { widths?: number[] } | null)?.widths;
	const attrs: Record<string, unknown> = { rows };
	if (header) attrs.header = true;
	if (widths?.length === first.length) attrs.widths = widths;
	return { id: String(node.attrs?.blockId ?? ""), type: "table", attrs };
}

/** Shares rounded to one decimal that add up to 100. */
const settle = (shares: number[]) => {
	const total = shares.reduce((sum, share) => sum + share, 0);
	const rounded = shares.map((share) => Math.round((share / total) * 1000) / 10);
	const drift = Math.round((100 - rounded.reduce((sum, share) => sum + share, 0)) * 10) / 10;
	rounded[rounded.length - 1] = Math.round(((rounded.at(-1) ?? 0) + drift) * 10) / 10;
	return rounded;
};

/** A table's shares now: its own, or even ones. */
export function sharesNow(table: EditorNode): number[] {
	const columns = TableMap.get(table).width;
	return sharesOf(table) ?? Array.from({ length: columns }, () => 100 / columns);
}

/** A table's own shares, or `null` while its columns are even. */
export const ownShares = (table: EditorNode) => sharesOf(table);

/** Sets a table's shares (`null`: even again). */
export function setShares(tr: Transaction, tablePos: number, shares: number[] | null) {
	const table = tr.doc.nodeAt(tablePos);
	if (!table) return;
	const data = { ...(table.attrs.data ?? {}) } as Record<string, unknown>;
	if (shares) data.widths = settle(shares);
	else delete data.widths;
	tr.setNodeAttribute(tablePos, "data", Object.keys(data).length ? data : null);
}

/**
 * The shares after a column was put in at `at` or taken out from `at`, from the shares before. A new column gets an even share and the others give
 * it room in proportion; a column taken out leaves its room to the others in proportion. A table never sized stays even.
 */
export function sharesAfter(before: number[] | null, change: { add: number } | { remove: number }): number[] | null {
	if (!before) return null;
	if ("add" in change) {
		const share = 100 / (before.length + 1);
		const next = before.map((width) => width * (1 - share / 100));
		next.splice(change.add, 0, share);
		return settle(next);
	}
	const next = before.filter((_, at) => at !== change.remove);
	return next.length ? settle(next) : null;
}

/** Moves the border after column `at` by `delta` percent: the column and its neighbour trade width, neither narrower than `MIN_SHARE`. */
export function tradeShares(shares: number[], at: number, delta: number): number[] {
	const left = shares[at];
	const right = shares[at + 1];
	if (left === undefined || right === undefined) return shares;
	const moved = Math.max(MIN_SHARE - left, Math.min(right - MIN_SHARE, delta));
	const next = [...shares];
	next[at] = left + moved;
	next[at + 1] = right - moved;
	return next;
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

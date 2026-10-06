import type { CmsNode } from "./types";

export const MAX_TABLE_COLUMNS = 64;

/** Limits so that invalid or excessive spans do not blow up the table grid of the editor and public render. */
export const boundedTableSpan = (value: unknown, max: number): number => {
	const span = Number(value ?? 1);
	return Number.isSafeInteger(span) && span > 0 ? Math.min(span, Math.max(1, max)) : 1;
};

type TableCellLike = { attrs?: Record<string, unknown> | null };
type TableLike = { content?: Array<{ content?: TableCellLike[] }> };

export const tableHasMergedCells = (node: TableLike): boolean =>
	(node.content ?? []).some((row) =>
		(row.content ?? []).some((cell) => Number(cell.attrs?.colspan ?? 1) > 1 || Number(cell.attrs?.rowspan ?? 1) > 1),
	);

/** GFM represents it exactly only when, without merges, just the whole first row is the header. */
export const hasGfmHeaderLayout = (rows: boolean[][]): boolean =>
	rows.length > 0 && rows.every((row, rowIndex) => row.every((header) => header === (rowIndex === 0)));

const isTrue = (value: unknown) => value === true || value === "true" || value === "";

/** Detects non-merged tables whose declared header layout differs from the GFM rule. */
export const hasNonGfmHeaderLayout = (node: CmsNode): boolean => {
	const rows = node.content ?? [];
	const explicit = rows.some((row) => (row.content ?? []).some((cell) => cell.attrs?.header !== undefined));
	return (
		explicit && !hasGfmHeaderLayout(rows.map((row) => (row.content ?? []).map((cell) => isTrue(cell.attrs?.header))))
	);
};

/** Checks the balance of unescaped brackets in the same way as a micromark directive label. */
export const hasBalancedLabelBrackets = (value: string): boolean => {
	let depth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (char === "\\") {
			index += 1;
			continue;
		}
		if (char === "[" && ++depth > 32) return false; // micromark label nesting limit
		if (char === "]") {
			depth -= 1;
			if (depth < 0) return false;
		}
	}
	return depth === 0;
};

/** Allowed range (px) of one column width. Values outside it are ignored. */
export const MAX_TABLE_COLUMN_WIDTH = 4096;

/** Reads `widths="120,,200"` into a per-column px array. Empty cells or invalid values give null. */
export const parseTableWidths = (value: unknown): Array<number | null> => {
	if (typeof value !== "string") return [];
	const widths = value
		.split(",")
		.slice(0, MAX_TABLE_COLUMNS)
		.map((part) => {
			const width = Number(part.trim());
			return part.trim() !== "" && Number.isSafeInteger(width) && width > 0 && width <= MAX_TABLE_COLUMN_WIDTH
				? width
				: null;
		});
	return widths.some((width) => width !== null) ? widths : [];
};

/** Writes a per-column px array as a `widths` attribute string. If there is no width at all, it is an empty string. */
export const formatTableWidths = (widths: readonly unknown[]): string => {
	const values = widths.map((width) =>
		typeof width === "number" && Number.isSafeInteger(width) && width > 0 && width <= MAX_TABLE_COLUMN_WIDTH
			? String(width)
			: "",
	);
	while (values.length > 0 && values.at(-1) === "") values.pop();
	return values.join(",");
};

export const tableWidths = (node: { attrs?: Record<string, unknown> | null }): Array<number | null> =>
	Array.isArray(node.attrs?.widths) ? node.attrs.widths.map((width) => (typeof width === "number" ? width : null)) : [];

/**
 * Finds the grid column number where each cell starts, taking rowspan and colspan into account.
 * The result has the same shape as `rows[row][cell]`.
 */
export const tableCellColumns = (rows: TableCellLike[][]): number[][] => {
	const occupied: boolean[][] = [];
	return rows.map((cells, rowIndex) => {
		let column = 0;
		return cells.map((cell) => {
			while (occupied[rowIndex]?.[column]) column += 1;
			const start = column;
			const colspan = boundedTableSpan(cell.attrs?.colspan, MAX_TABLE_COLUMNS - start);
			const rowspan = boundedTableSpan(cell.attrs?.rowspan, rows.length - rowIndex);
			for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
				occupied[r] ??= [];
				for (let c = start; c < start + colspan; c += 1) occupied[r][c] = true;
			}
			column = start + colspan;
			return start;
		});
	});
};

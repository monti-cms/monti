import type { CmsNode } from "./types.js";
export declare const MAX_TABLE_COLUMNS = 64;
/** Limits so that invalid or excessive spans do not blow up the table grid of the editor and public render. */
export declare const boundedTableSpan: (value: unknown, max: number) => number;
type TableCellLike = {
    attrs?: Record<string, unknown> | null;
};
type TableLike = {
    content?: Array<{
        content?: TableCellLike[];
    }>;
};
export declare const tableHasMergedCells: (node: TableLike) => boolean;
/** GFM represents it exactly only when, without merges, just the whole first row is the header. */
export declare const hasGfmHeaderLayout: (rows: boolean[][]) => boolean;
/** Detects non-merged tables whose declared header layout differs from the GFM rule. */
export declare const hasNonGfmHeaderLayout: (node: CmsNode) => boolean;
/** Checks the balance of unescaped brackets in the same way as a micromark directive label. */
export declare const hasBalancedLabelBrackets: (value: string) => boolean;
/** Allowed range (px) of one column width. Values outside it are ignored. */
export declare const MAX_TABLE_COLUMN_WIDTH = 4096;
/** Reads `widths="120,,200"` into a per-column px array. Empty cells or invalid values give null. */
export declare const parseTableWidths: (value: unknown) => Array<number | null>;
/** Writes a per-column px array as a `widths` attribute string. If there is no width at all, it is an empty string. */
export declare const formatTableWidths: (widths: readonly unknown[]) => string;
export declare const tableWidths: (node: {
    attrs?: Record<string, unknown> | null;
}) => Array<number | null>;
/**
 * Finds the grid column number where each cell starts, taking rowspan and colspan into account.
 * The result has the same shape as `rows[row][cell]`.
 */
export declare const tableCellColumns: (rows: TableCellLike[][]) => number[][];
export {};

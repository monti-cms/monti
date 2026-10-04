/**
 * Column widths (`::::columns{widths="60,40"}`). Write each column's ratio (%) separated by commas.
 * The public renderer and the editor read it with the same rules. If empty or not matching the column count, columns are split equally.
 */
/** Minimum ratio (%) of one column. Dragging never narrows a column below this. */
export declare const MIN_COLUMN_PERCENT = 10;
/** Reads `widths` as per-column ratios. Returns null (split equally) if the count differs from the column count or any value is invalid. */
export declare const parseColumnWidths: (value: unknown, count: number) => number[] | null;
/** Normalizes to integer ratios summing to 100. The remainder left by rounding goes to the last column. */
export declare const toPercentWidths: (widths: readonly number[] | null, count: number) => number[];
/** If all columns have the same ratio, nothing is stored (empty string). */
export declare const formatColumnWidths: (widths: readonly number[]) => string;
/** CSS grid column definition. Without widths, columns are split equally. */
export declare const columnsGridTemplate: (widths: readonly number[] | null, count: number) => string;

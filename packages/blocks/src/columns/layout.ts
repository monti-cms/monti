/**
 * Column widths (`::::columns{widths="60,40"}`). Write each column's ratio (%) separated by commas.
 * The public renderer and the editor read it with the same rules. If empty or not matching the column count, columns are split equally.
 */

/** Minimum ratio (%) of one column. Dragging never narrows a column below this. */
export const MIN_COLUMN_PERCENT = 10;

/** Reads `widths` as per-column ratios. Returns null (split equally) if the count differs from the column count or any value is invalid. */
export const parseColumnWidths = (value: unknown, count: number): number[] | null => {
	if (typeof value !== "string" || !value.trim()) return null;
	const widths = value.split(",").map((part) => Number(part.trim()));
	if (widths.length !== count || widths.some((width) => !Number.isFinite(width) || width <= 0)) return null;
	return widths;
};

/** Normalizes to integer ratios summing to 100. The remainder left by rounding goes to the last column. */
export const toPercentWidths = (widths: readonly number[] | null, count: number): number[] => {
	if (count <= 0) return [];
	const source = widths && widths.length === count ? widths : Array.from({ length: count }, () => 1);
	const total = source.reduce((sum, width) => sum + width, 0);
	const rounded = source.map((width) => Math.round((width / total) * 100));
	rounded[count - 1] = 100 - rounded.slice(0, -1).reduce((sum, width) => sum + width, 0);
	return rounded;
};

/** If all columns have the same ratio, nothing is stored (empty string). */
export const formatColumnWidths = (widths: readonly number[]): string =>
	widths.every((width) => width === widths[0]) ? "" : widths.join(",");

/** CSS grid column definition. Without widths, columns are split equally. */
export const columnsGridTemplate = (widths: readonly number[] | null, count: number): string =>
	widths ? widths.map((width) => `minmax(0, ${width}fr)`).join(" ") : `repeat(${count}, minmax(0, 1fr))`;

/**
 * Column widths (`::::columns{widths="60,40"}`). Write each column's ratio (%) separated by commas.
 * The site and the editor read it with the same rules (the editor's dragging of the widths comes with the columns' editor screen). If empty or not matching the column count, columns are split equally.
 */

/** Reads `widths` as per-column ratios. Returns null (split equally) if the count differs from the column count or any value is invalid. */
export const parseColumnWidths = (value: unknown, count: number): number[] | null => {
	if (typeof value !== "string" || !value.trim()) return null;
	const widths = value.split(",").map((part) => Number(part.trim()));
	if (widths.length !== count || widths.some((width) => !Number.isFinite(width) || width <= 0)) return null;
	return widths;
};

/** CSS grid column definition. Without widths, columns are split equally. */
export const columnsGridTemplate = (widths: readonly number[] | null, count: number): string =>
	widths ? widths.map((width) => `minmax(0, ${width}fr)`).join(" ") : `repeat(${count}, minmax(0, 1fr))`;

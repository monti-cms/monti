/** Sets the name and color for each series (each slice for pie charts). Colors are theme variables (`--chart-1` to `--chart-5`). */
export const toChartConfig = (spec) => {
    if (spec.type === "pie" && spec.labelKey) {
        return Object.fromEntries(spec.data.map((row) => [
            String(row[spec.labelKey] ?? ""),
            { label: String(row[spec.labelKey] ?? ""), color: String(row.fill ?? "var(--chart-1)") },
        ]));
    }
    return Object.fromEntries(spec.series.map((series) => [series.key, { label: series.label, color: `var(--${series.colorToken})` }]));
};
/** Estimates the Y-axis tick label width (px) from the data. A tick can land one step above the data maximum (e.g. 95 → 100). */
const Y_AXIS_CHAR_WIDTH = 7;
const Y_AXIS_TICK_GAP = 14;
export const estimateYAxisWidth = (spec) => {
    const values = spec.data.flatMap((row) => spec.series.map((series) => Number(row[series.key])).filter((value) => Number.isFinite(value)));
    if (spec.options.yRange)
        values.push(spec.options.yRange.min, spec.options.yRange.max);
    const labels = values.flatMap((value) => [String(value), String(Math.round(value * 1.25))]);
    const longest = Math.max(1, ...labels.map((label) => label.length));
    return longest * Y_AXIS_CHAR_WIDTH + Y_AXIS_TICK_GAP;
};
/** Value shown in value labels (`show values`) and tooltips. Numbers are grouped by thousands. */
export const formatChartValue = (value) => value == null || value === false ? "" : typeof value === "number" ? value.toLocaleString() : String(value);

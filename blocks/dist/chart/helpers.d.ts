import type { CartesianChartSpec, NormalizedChartSpec } from "./types.js";
import type { ChartConfig } from "./ui.js";
/** Sets the name and color for each series (each slice for pie charts). Colors are theme variables (`--chart-1` to `--chart-5`). */
export declare const toChartConfig: (spec: NormalizedChartSpec) => ChartConfig;
export declare const estimateYAxisWidth: (spec: CartesianChartSpec) => number;
/** Value shown in value labels (`show values`) and tooltips. Numbers are grouped by thousands. */
export declare const formatChartValue: (value: unknown) => string;

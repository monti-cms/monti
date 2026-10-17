export const CHART_TYPES = ["bar", "line", "area", "pie"];
export const CHART_THEME_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
/**
 * The CSS value of a chart color token. The admin screen defines `--monti-chart-N` (taking the host's `--chart-N` when it sets one);
 * on a public page only `--chart-N` exists, so it is the fallback.
 */
export const chartColor = (token) => `var(--monti-${token}, var(--${token}))`;

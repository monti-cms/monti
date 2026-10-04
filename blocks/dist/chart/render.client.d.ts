/**
 * Chart rendering slot. On the server and before loading, shows the chart source; in the browser, loads `recharts` (optional dependency)
 * and swaps it for the chart. If loading fails, the source is left as is.
 */
export declare function ChartClient({ source }: {
    source: string;
}): import("react").JSX.Element;

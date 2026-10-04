"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*
 * Drawing frame for the chart preview (a thin layer over recharts, shaped like the shadcn/ui chart). Colors use `color` (a theme variable) from `config`.
 * Used only by the editor preview (`./preview`). The public page is rendered by the site.
 */
import { cn } from "@monti-cms/admin/kit";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { CHART_LEGEND_HEIGHT, DEFAULT_CHART_DIMENSIONS } from "./layout.js";
const ChartContext = React.createContext(null);
const useChart = () => {
    const context = React.useContext(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }
    return context;
};
export const useChartDimensions = () => useChart().dimensions;
export const ChartContainer = ({ id, className, children, config, }) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
    const [dimensions, setDimensions] = React.useState(DEFAULT_CHART_DIMENSIONS);
    const chartVars = Object.fromEntries(Object.entries(config)
        .filter(([, itemConfig]) => itemConfig.color)
        .map(([key, itemConfig]) => [`--color-${key}`, itemConfig.color]));
    return (_jsx(ChartContext.Provider, { value: { config, dimensions }, children: _jsx("div", { "data-slot": "chart", "data-chart": chartId, style: chartVars, className: cn("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-cms-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-cms-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-cms-border [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-cms-muted/60 [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden", className), children: _jsx(RechartsPrimitive.ResponsiveContainer, { width: "100%", height: "100%", initialDimension: DEFAULT_CHART_DIMENSIONS, onResize: (width, height) => {
                    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                        return;
                    }
                    setDimensions((current) => {
                        if (current.width === width && current.height === height) {
                            return current;
                        }
                        return { width, height };
                    });
                }, children: children }) }) }));
};
export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;
export const ChartTooltipContent = ({ active, payload, label, className, hideLabel = false, nameKey, }) => {
    const { config } = useChart();
    if (!active || !payload?.length) {
        return null;
    }
    return (_jsxs("div", { className: cn("grid min-w-[8rem] gap-1.5 rounded-lg border border-cms-border/50 bg-cms-background px-2.5 py-1.5 text-xs shadow-xl", className), children: [!hideLabel && label ? _jsx("div", { className: "font-medium", children: String(config[String(label)]?.label ?? label) }) : null, _jsx("div", { className: "grid gap-1.5", children: payload
                    .filter((item) => item.type !== "none")
                    .map((item) => {
                    const key = String(nameKey ? item.payload?.[nameKey] : (item.name ?? item.dataKey ?? "value"));
                    const itemConfig = config[key] ?? config[String(item.name ?? item.dataKey ?? "value")];
                    const itemKey = `${key}-${String(item.value ?? item.color ?? "")}`;
                    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-2.5 w-2.5 rounded-[2px]", style: { backgroundColor: item.color ?? item.payload?.fill } }), _jsxs("div", { className: "flex flex-1 items-center justify-between gap-3", children: [_jsx("span", { className: "text-cms-muted-foreground", children: itemConfig?.label ?? key }), _jsx("span", { className: "font-medium font-mono text-cms-foreground tabular-nums", children: typeof item.value === "number" ? item.value.toLocaleString() : String(item.value) })] })] }, itemKey));
                }) })] }));
};
export const ChartLegendContent = ({ payload, className, nameKey, onHeightChange, }) => {
    const { config } = useChart();
    const legendPayload = payload;
    const legendRef = React.useRef(null);
    React.useEffect(() => {
        const element = legendRef.current;
        if (!element) {
            return;
        }
        const syncHeight = () => {
            const nextHeight = Math.max(Math.ceil(element.getBoundingClientRect().height), CHART_LEGEND_HEIGHT);
            onHeightChange?.(nextHeight);
        };
        syncHeight();
        if (typeof ResizeObserver === "undefined") {
            return;
        }
        const observer = new ResizeObserver(() => {
            syncHeight();
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [onHeightChange]);
    if (!legendPayload?.length) {
        return null;
    }
    return (_jsx("div", { ref: legendRef, className: cn("flex flex-wrap items-center justify-center gap-4 pt-3", className), children: legendPayload
            .filter((item) => item.type !== "none")
            .map((item) => {
            const payloadValue = item.payload;
            const lookupKey = String(nameKey ? payloadValue?.[nameKey] : (item.value ?? item.dataKey ?? "value"));
            const itemConfig = config[lookupKey] ?? config[String(item.dataKey ?? "value")];
            const itemKey = `${lookupKey}-${String(item.color ?? "")}`;
            return (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "h-2 w-2 rounded-[2px]", style: { backgroundColor: item.color } }), _jsx("span", { children: itemConfig?.label ?? lookupKey })] }, itemKey));
        }) }));
};

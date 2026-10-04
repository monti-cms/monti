import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*
 * Public-page chart (drawn on recharts, optional dependency `recharts`). Read only when `render.client.tsx` loads it in the browser.
 * Uses the same chart syntax and colors (`--chart-1` to `--chart-5`) as the editor preview (`./preview`), and is styled with
 * `cms-block-chart-*` classes (this package's `styles.css`) without admin UI code or Tailwind.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { estimateYAxisWidth, formatChartValue, toChartConfig } from "./helpers.js";
import { CHART_LEGEND_HEIGHT, DEFAULT_CHART_DIMENSIONS, resolvePieGeometry } from "./layout.js";
const FrameState = createContext({ config: {}, dimensions: DEFAULT_CHART_DIMENSIONS });
/** Outer chart frame. Stretches to fit its size and passes series colors down as `--color-<key>` variables. */
function ChartFrame({ config, children }) {
    const [dimensions, setDimensions] = useState(DEFAULT_CHART_DIMENSIONS);
    const style = Object.fromEntries(Object.entries(config)
        .filter(([, item]) => item.color)
        .map(([key, item]) => [`--color-${key}`, item.color]));
    return (_jsx(FrameState.Provider, { value: { config, dimensions }, children: _jsx("div", { className: "cms-block-chart-frame", style: style, children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", initialDimension: DEFAULT_CHART_DIMENSIONS, onResize: (width, height) => {
                    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
                        return;
                    setDimensions((current) => current.width === width && current.height === height ? current : { width, height });
                }, children: children }) }) }));
}
function TooltipContent({ active, payload, label, hideLabel = false, nameKey, }) {
    const { config } = useContext(FrameState);
    if (!active || !payload?.length)
        return null;
    return (_jsxs("div", { className: "cms-block-chart-tooltip", children: [!hideLabel && label ? (_jsx("div", { className: "cms-block-chart-tooltip-label", children: String(config[String(label)]?.label ?? label) })) : null, payload
                .filter((item) => item.type !== "none")
                .map((item) => {
                const key = String(nameKey ? item.payload?.[nameKey] : (item.name ?? item.dataKey ?? "value"));
                const itemConfig = config[key] ?? config[String(item.name ?? item.dataKey ?? "value")];
                return (_jsxs("div", { className: "cms-block-chart-tooltip-row", children: [_jsx("span", { className: "cms-block-chart-swatch", style: { backgroundColor: item.color ?? item.payload?.fill } }), _jsx("span", { className: "cms-block-chart-tooltip-name", children: itemConfig?.label ?? key }), _jsx("span", { className: "cms-block-chart-tooltip-value", children: formatChartValue(item.value) })] }, `${key}-${String(item.value ?? item.color ?? "")}`));
            })] }));
}
/** Legend. Reports when its height changes because lines wrap (the pie chart is drawn to fit above the legend). */
function LegendContent({ payload, nameKey, onHeightChange, }) {
    const { config } = useContext(FrameState);
    const ref = useRef(null);
    useEffect(() => {
        const element = ref.current;
        if (!element)
            return;
        const sync = () => onHeightChange(Math.max(Math.ceil(element.getBoundingClientRect().height), CHART_LEGEND_HEIGHT));
        sync();
        if (typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(sync);
        observer.observe(element);
        return () => observer.disconnect();
    }, [onHeightChange]);
    if (!payload?.length)
        return null;
    return (_jsx("div", { ref: ref, className: "cms-block-chart-legend", children: payload
            .filter((item) => item.type !== "none")
            .map((item) => {
            const key = String(nameKey ? item.payload?.[nameKey] : (item.value ?? item.dataKey ?? "value"));
            const itemConfig = config[key] ?? config[String(item.dataKey ?? "value")];
            return (_jsxs("span", { className: "cms-block-chart-legend-item", children: [_jsx("span", { className: "cms-block-chart-swatch", style: { backgroundColor: item.color } }), itemConfig?.label ?? key] }, `${key}-${String(item.color ?? "")}`));
        }) }));
}
const CARTESIAN = { bar: BarChart, line: LineChart, area: AreaChart };
/** Value labels (`show values`). */
const valueLabel = (spec) => spec.options.showValues ? (_jsx(LabelList, { position: "top", offset: spec.type === "bar" ? 8 : 10, formatter: formatChartValue, className: "cms-block-chart-value" })) : null;
const renderSeries = (spec) => spec.series.map((series) => {
    const color = `var(--color-${series.key})`;
    if (spec.type === "bar") {
        return (_jsx(Bar, { dataKey: series.key, fill: color, radius: 8, isAnimationActive: false, children: valueLabel(spec) }, series.key));
    }
    if (spec.type === "line") {
        return (_jsx(Line, { type: "monotone", dataKey: series.key, stroke: color, strokeWidth: 2, dot: false, isAnimationActive: false, children: valueLabel(spec) }, series.key));
    }
    return (_jsx(Area, { type: "monotone", dataKey: series.key, stroke: color, fill: color, fillOpacity: 0.24, isAnimationActive: false, children: valueLabel(spec) }, series.key));
});
function CartesianView({ spec }) {
    const Chart = CARTESIAN[spec.type];
    const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
    return (_jsx(ChartFrame, { config: toChartConfig(spec), children: _jsxs(Chart, { accessibilityLayer: true, data: spec.data, margin: { top: spec.options.showValues ? 28 : 12, right: 12, left: spec.options.hideYAxis ? 12 : 0, bottom: 0 }, children: [spec.options.hideGrid ? null : _jsx(CartesianGrid, { vertical: false }), _jsx(XAxis, { dataKey: spec.xKey, tickLine: false, tickMargin: 10, axisLine: false }), _jsx(YAxis, { hide: spec.options.hideYAxis, width: estimateYAxisWidth(spec), tickLine: false, tickMargin: 10, axisLine: false, domain: spec.options.yRange ? [spec.options.yRange.min, spec.options.yRange.max] : undefined, allowDataOverflow: !!spec.options.yRange }), _jsx(Tooltip, { cursor: false, content: _jsx(TooltipContent, {}) }), spec.options.showLegend ? (_jsx(Legend, { verticalAlign: "bottom", height: legendHeight, content: _jsx(LegendContent, { onHeightChange: setLegendHeight }) })) : null, renderSeries(spec)] }) }));
}
function ResponsivePie({ spec, legendHeight }) {
    const { dimensions } = useContext(FrameState);
    const geometry = resolvePieGeometry(dimensions, spec.options.showLegend ? legendHeight : 0);
    return (_jsx(Pie, { data: spec.data, dataKey: spec.valueKey, nameKey: spec.labelKey, isAnimationActive: false, ...geometry }));
}
function PieView({ spec }) {
    const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
    return (_jsx(ChartFrame, { config: toChartConfig(spec), children: _jsxs(PieChart, { children: [_jsx(Tooltip, { cursor: false, content: _jsx(TooltipContent, { hideLabel: true, nameKey: spec.labelKey }) }), spec.options.showLegend ? (_jsx(Legend, { verticalAlign: "bottom", height: legendHeight, content: _jsx(LegendContent, { nameKey: spec.labelKey, onHeightChange: setLegendHeight }) })) : null, _jsx(ResponsivePie, { spec: spec, legendHeight: legendHeight })] }) }));
}
/** Draws the chart source (`source`). If the syntax is wrong, draws nothing (the server already renders the error box). */
export function ChartView({ source }) {
    const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(source)), [source]);
    const spec = normalized.spec;
    if (!spec)
        return null;
    return (_jsx("figure", { className: "cms-block-chart", "data-state": "ready", children: spec.type === "pie" ? _jsx(PieView, { spec: spec }) : _jsx(CartesianView, { spec: spec }) }));
}

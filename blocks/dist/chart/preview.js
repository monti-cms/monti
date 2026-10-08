"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, AlertDescription, AlertTitle, cn } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { AlertOctagon } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis, } from "recharts";
import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { chartErrorLine } from "./errors.js";
import { estimateYAxisWidth, formatChartValue, toChartConfig } from "./helpers.js";
import { CHART_LEGEND_HEIGHT, resolvePieGeometry } from "./layout.js";
import { chartMessages } from "./messages.js";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, useChartDimensions, } from "./ui.js";
/**
 * Default editor preview for the chart block. Draws the chart syntax (`./dsl`) with recharts (optional dependency `recharts`). Loaded only
 * when the chart block extension's admin provider opens a preview via `fencePreviews.chart`. A site can replace it by registering its own
 * renderer under the same name. Colors are the series' theme variables (`--chart-1` to `--chart-5`).
 */
function ChartErrorCard({ errors }) {
    const t = useTranslator(chartMessages);
    return (_jsx("div", { className: "not-prose my-6", children: _jsxs(Alert, { variant: "danger", children: [_jsx(AlertOctagon, {}), _jsx(AlertTitle, { children: t("error.title") }), _jsx(AlertDescription, { children: _jsx("ul", { className: "ml-4 list-disc space-y-1", children: errors.map((error) => (_jsx("li", { children: chartErrorLine(error, t) }, `${error.line}-${error.code}-${JSON.stringify(error.values ?? {})}`))) }) })] }) }));
}
const CARTESIAN = { bar: BarChart, line: LineChart, area: AreaChart };
const VALUE_LABEL_CLASS = "fill-cms-foreground font-medium text-[11px]";
/** Value labels (`show values`). */
const valueLabel = (spec) => spec.options.showValues ? (_jsx(LabelList, { position: "top", offset: spec.type === "bar" ? 8 : 10, formatter: formatChartValue, className: VALUE_LABEL_CLASS })) : null;
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
function ResponsivePie({ spec, legendHeight }) {
    const geometry = resolvePieGeometry(useChartDimensions(), spec.options.showLegend ? legendHeight : 0);
    return (_jsx(Pie, { data: spec.data, dataKey: spec.valueKey, nameKey: spec.labelKey, isAnimationActive: false, ...geometry }));
}
function CartesianPreview({ spec, className }) {
    const Chart = CARTESIAN[spec.type];
    const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
    return (_jsx(ChartContainer, { config: toChartConfig(spec), className: cn("not-prose my-6 w-full min-w-0", className), children: _jsxs(Chart, { accessibilityLayer: true, data: spec.data, margin: { top: spec.options.showValues ? 28 : 12, right: 12, left: spec.options.hideYAxis ? 12 : 0, bottom: 0 }, children: [spec.options.hideGrid ? null : _jsx(CartesianGrid, { vertical: false }), _jsx(XAxis, { dataKey: spec.xKey, tickLine: false, tickMargin: 10, axisLine: false }), _jsx(YAxis, { hide: spec.options.hideYAxis, width: estimateYAxisWidth(spec), tickLine: false, tickMargin: 10, axisLine: false, domain: spec.options.yRange ? [spec.options.yRange.min, spec.options.yRange.max] : undefined, allowDataOverflow: !!spec.options.yRange }), _jsx(ChartTooltip, { cursor: false, content: _jsx(ChartTooltipContent, {}) }), spec.options.showLegend ? (_jsx(ChartLegend, { verticalAlign: "bottom", height: legendHeight, content: _jsx(ChartLegendContent, { onHeightChange: setLegendHeight }) })) : null, renderSeries(spec)] }) }));
}
function PiePreview({ spec, className }) {
    const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
    return (_jsx(ChartContainer, { config: toChartConfig(spec), className: cn("not-prose my-6 w-full min-w-0", className), children: _jsxs(PieChart, { children: [_jsx(ChartTooltip, { cursor: false, content: _jsx(ChartTooltipContent, { hideLabel: true, nameKey: spec.labelKey }) }), spec.options.showLegend ? (_jsx(ChartLegend, { verticalAlign: "bottom", height: legendHeight, content: _jsx(ChartLegendContent, { nameKey: spec.labelKey, onHeightChange: setLegendHeight }) })) : null, _jsx(ResponsivePie, { spec: spec, legendHeight: legendHeight })] }) }));
}
/** Draws the chart source (`source`). On a syntax error, reports each line. */
export function ChartPreview({ source, className }) {
    const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(source)), [source]);
    if (!normalized.spec)
        return _jsx(ChartErrorCard, { errors: normalized.errors });
    return normalized.spec.type === "pie" ? (_jsx(PiePreview, { spec: normalized.spec, className: className })) : (_jsx(CartesianPreview, { spec: normalized.spec, className: className }));
}

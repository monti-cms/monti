import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { blockLabels } from "../shared/labels.js";
import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { ChartClient } from "./render.client.js";
function ChartError({ errors, labels }) {
    return (_jsxs("div", { className: "cms-block-chart-error", role: "alert", children: [_jsx("strong", { children: labels.chartError }), _jsx("ul", { children: errors.map((error) => (_jsx("li", { children: labels.chartErrorLine(error) }, `${error.line}-${error.code}-${JSON.stringify(error.values ?? {})}`))) })] }));
}
/**
 * Rendering of the chart block (` ```chart `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). If the syntax is wrong, the
 * server renders each line's error; otherwise the browser draws the chart (the source is shown until then).
 */
export function Chart({ source, labels = blockLabels() }) {
    const text = source ?? "";
    const normalized = normalizeChartDsl(parseChartDsl(text));
    if (!normalized.spec)
        return _jsx(ChartError, { errors: normalized.errors, labels: labels });
    return _jsx(ChartClient, { source: text });
}
/** Public components for the chart in the JSON renderer (`renderDocument`): the block `chart`. The code of the fence arrives as `source`. */
export const documentComponents = ({ locale }) => {
    const labels = blockLabels(locale);
    return {
        blocks: { chart: ({ source }) => _jsx(Chart, { source: source, labels: labels }) },
    };
};

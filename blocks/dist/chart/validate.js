import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { chartErrorLine } from "./errors.js";
import { chartMessages } from "./messages.js";
/** Checks the source of a chart with its own parser (`parseChartDsl`, `normalizeChartDsl`): one issue per syntax error, with the line it is on. */
export const validateChartBlock = (node, { site }) => {
    const text = site.createTranslator(chartMessages);
    return normalizeChartDsl(parseChartDsl(node.source ?? "")).errors.map((error) => ({
        code: "chart_syntax",
        message: chartErrorLine(error, text),
        params: { line: error.line, error: error.code },
    }));
};

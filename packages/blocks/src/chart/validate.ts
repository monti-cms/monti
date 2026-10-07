import type { BlockValidate } from "@monti-cms/core";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { chartErrorLine } from "./errors";
import { chartMessages } from "./messages";

/** Checks the source of a chart with its own parser (`parseChartDsl`, `normalizeChartDsl`): one issue per syntax error, with the line it is on. */
export const validateChartBlock: BlockValidate = (node, { site }) => {
	const text = site.createTranslator(chartMessages);
	return normalizeChartDsl(parseChartDsl(node.source ?? "")).errors.map((error) => ({
		code: "chart_syntax",
		message: chartErrorLine(error, text),
		params: { line: error.line, error: error.code },
	}));
};

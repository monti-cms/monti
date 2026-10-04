import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { normalizeChartDsl, parseChartDsl } from "../dsl";
import { type ChartText, chartErrorLine } from "../errors";
import { chartMessages } from "../messages";

const textIn =
	(language: string): ChartText =>
	(key, vars) =>
		translate(chartMessages, language, key, vars);

describe("chart syntax error messages", () => {
	const [error] = normalizeChartDsl(parseChartDsl("chart radar\ndata")).errors;

	it("the parser gives only a code and values; the text is built from the dictionary in the caller's language", () => {
		expect(error).toEqual({ line: 1, code: "unsupported_type", values: { type: "radar" } });
		if (!error) return;
		expect(chartErrorLine(error, textIn("en"))).toBe("Line 1: Unsupported chart type: radar");
		expect(chartErrorLine(error, textIn("ko"))).toContain("radar");
		expect(chartErrorLine(error, textIn("ko"))).not.toBe(chartErrorLine(error, textIn("en")));
	});

	it("languages not in the dictionary show English, and Korean and Japanese cover every error code", () => {
		if (!error) return;
		expect(chartErrorLine(error, textIn("fr"))).toBe("Line 1: Unsupported chart type: radar");
		const keys = Object.keys(chartMessages.messages.en).filter((key) => key.startsWith("error."));
		for (const language of ["ko", "ja"]) {
			const dict = chartMessages.messages[language] ?? {};
			expect(keys.filter((key) => !(key in dict))).toEqual([]);
		}
	});
});

import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { normalizeChartDsl, parseChartDsl } from "../dsl";
import { type ChartText, chartErrorLine } from "../errors";
import { chartMessages } from "../messages";

const textIn =
	(language: string): ChartText =>
	(key, vars) =>
		translate(chartMessages, language, key, vars);

describe("차트 문법 오류 문구", () => {
	const [error] = normalizeChartDsl(parseChartDsl("chart radar\ndata")).errors;

	it("파서는 코드와 값만 주고, 글은 쓰는 쪽의 언어로 사전에서 만든다", () => {
		expect(error).toEqual({ line: 1, code: "unsupported_type", values: { type: "radar" } });
		if (!error) return;
		expect(chartErrorLine(error, textIn("en"))).toBe("Line 1: Unsupported chart type: radar");
		expect(chartErrorLine(error, textIn("ko"))).toContain("radar");
		expect(chartErrorLine(error, textIn("ko"))).not.toBe(chartErrorLine(error, textIn("en")));
	});

	it("사전에 없는 언어는 영어로 보이고, 한국어·일본어도 모든 오류 코드를 가진다", () => {
		if (!error) return;
		expect(chartErrorLine(error, textIn("fr"))).toBe("Line 1: Unsupported chart type: radar");
		const keys = Object.keys(chartMessages.messages.en).filter((key) => key.startsWith("error."));
		for (const language of ["ko", "ja"]) {
			const dict = chartMessages.messages[language] ?? {};
			expect(keys.filter((key) => !(key in dict))).toEqual([]);
		}
	});
});

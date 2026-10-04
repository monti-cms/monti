import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { chartAi, validateChart } from "../../chart/ai";
import { mermaidAi, validateMermaid } from "../ai";
import { mermaidMessages } from "../messages";

// 화면 언어는 사이트 설정을 따르므로(예: 한국어 블로그 설정) 문구는 사전과 값으로 확인한다.
const mermaidText = (key: "ai.error.notFence" | "ai.error.empty") => [
	translate(mermaidMessages, "en", key),
	translate(mermaidMessages, "ko", key),
];

describe("다이어그램·차트 AI 결과의 코드 검사", () => {
	it("Mermaid: 펜스 하나이고 아는 다이어그램 종류만 통과한다", () => {
		expect(validateMermaid("```mermaid\ngraph TD\n  A --> B\n```")).toBeUndefined();
		expect(validateMermaid("```mermaid\n%% 설명\nsequenceDiagram\n  A->>B: 안녕\n```")).toBeUndefined();
		expect(mermaidText("ai.error.notFence")).toContain(validateMermaid("graph TD\n  A --> B"));
		expect(mermaidText("ai.error.empty")).toContain(validateMermaid("```mermaid\n```"));
		expect(validateMermaid("```mermaid\ngrpah TD\n```")).toContain("grpah");
		expect(mermaidText("ai.error.notFence")).toContain(validateMermaid("설명\n\n```mermaid\ngraph TD\n```"));
	});

	it("차트: 펜스 하나이고 차트 문법에 맞아야 한다", () => {
		const chart = (body: string) => `\`\`\`chart\n${body}\n\`\`\``;
		expect(
			validateChart(chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200")),
		).toBeUndefined();
		// 오류 글은 코드와 값(줄 번호·이름)에서 화면 언어로 만든다.
		expect(validateChart(chart("chart radar\ndata"))).toMatch(/1.*radar/);
		expect(
			validateChart(chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 많음")),
		).toMatch(/7.*views/);
		expect(typeof validateChart("chart bar")).toBe("string");
		expect(validateChart("chart bar")).toMatch(/chart/);
	});

	it("가짜 연결의 답(fake)은 문법 검사를 통과하고, 고칠 블록은 모양을 지킨 채 한 줄을 더한다", () => {
		const diagram = "```mermaid\ngraph TD\n  A --> B\n```";
		const mermaidDraft = mermaidAi.draft().fake({ title: '"따옴표" 제목' });
		const mermaidEdit = mermaidAi.edit().fake({ block: diagram });
		expect(validateMermaid(mermaidDraft)).toBeUndefined();
		expect(validateMermaid(mermaidEdit)).toBeUndefined();
		expect(mermaidEdit).toContain("A --> B");
		expect(mermaidEdit).not.toBe(diagram);

		const chart =
			"```chart\nchart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200\n```";
		const chartDraft = chartAi.draft().fake({ title: "a | b" });
		const chartEdit = chartAi.edit().fake({ block: chart });
		expect(validateChart(chartDraft)).toBeUndefined();
		expect(validateChart(chartEdit)).toBeUndefined();
		expect(chartEdit.match(/Jan \| 1200/g)).toHaveLength(2);
	});
});

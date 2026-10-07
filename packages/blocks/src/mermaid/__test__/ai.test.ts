import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { chartAi, validateChart } from "../../chart/ai";
import { renderSite as site } from "../../test/render-config";
import { mermaidAi, validateMermaid } from "../ai";
import { mermaidMessages } from "../messages";

// The UI language follows the site config (e.g. a Korean setup), so messages are checked against the dictionary and values.
const mermaidText = (key: "ai.error.notFence" | "ai.error.empty") => [
	translate(mermaidMessages, "en", key),
	translate(mermaidMessages, "ko", key),
];

describe("code validation of diagram and chart AI results", () => {
	it("Mermaid: passes only a single fence with a known diagram type", () => {
		expect(validateMermaid(site, "```mermaid\ngraph TD\n  A --> B\n```")).toBeUndefined();
		expect(validateMermaid(site, "```mermaid\n%% 설명\nsequenceDiagram\n  A->>B: 안녕\n```")).toBeUndefined();
		expect(mermaidText("ai.error.notFence")).toContain(validateMermaid(site, "graph TD\n  A --> B"));
		expect(mermaidText("ai.error.empty")).toContain(validateMermaid(site, "```mermaid\n```"));
		expect(validateMermaid(site, "```mermaid\ngrpah TD\n```")).toContain("grpah");
		expect(mermaidText("ai.error.notFence")).toContain(validateMermaid(site, "설명\n\n```mermaid\ngraph TD\n```"));
	});

	it("chart: must be a single fence that follows the chart syntax", () => {
		const chart = (body: string) => `\`\`\`chart\n${body}\n\`\`\``;
		expect(
			validateChart(
				site,
				chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200"),
			),
		).toBeUndefined();
		// Error text is built in the UI language from the code and values (line number, name).
		expect(validateChart(site, chart("chart radar\ndata"))).toMatch(/1.*radar/);
		expect(
			validateChart(
				site,
				chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 많음"),
			),
		).toMatch(/7.*views/);
		expect(typeof validateChart(site, "chart bar")).toBe("string");
		expect(validateChart(site, "chart bar")).toMatch(/chart/);
	});

	it("the fake connection answer passes syntax validation, and the block to fix keeps its shape while gaining one line", () => {
		const diagram = "```mermaid\ngraph TD\n  A --> B\n```";
		const mermaidDraft = mermaidAi.draft()(site).fake({ title: '"따옴표" 제목' });
		const mermaidEdit = mermaidAi.edit()(site).fake({ block: diagram });
		expect(validateMermaid(site, mermaidDraft)).toBeUndefined();
		expect(validateMermaid(site, mermaidEdit)).toBeUndefined();
		expect(mermaidEdit).toContain("A --> B");
		expect(mermaidEdit).not.toBe(diagram);

		const chart =
			"```chart\nchart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200\n```";
		const chartDraft = chartAi.draft()(site).fake({ title: "a | b" });
		const chartEdit = chartAi.edit()(site).fake({ block: chart });
		expect(validateChart(site, chartDraft)).toBeUndefined();
		expect(validateChart(site, chartEdit)).toBeUndefined();
		expect(chartEdit.match(/Jan \| 1200/g)).toHaveLength(2);
	});
});

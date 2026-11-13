import { defineBlock, z } from "@monti-cms/core";
import { chartData, KINDS } from "./data";
import { Chart } from "./site";

/** A chart (`:::chart{kind="line" title="…"}` holding a table): the table's numbers drawn as bars, lines, areas or a pie (doc 18). */
export const chart = defineBlock({
	type: "chart",
	label: { ko: "차트", en: "Chart" },
	description:
		"A chart of the one table block it holds: the table's first column names the points, each other column is a series named by its header cell; cells are numbers. `kind` is bar (when left out), line, area or pie (the first series); `title` is optional.",
	menu: "insert",
	attrs: z.object({ kind: z.enum(KINDS).optional(), title: z.string().optional() }),
	fields: {
		kind: {
			label: { ko: "차트 종류", en: "Chart kind" },
			options: {
				bar: { ko: "막대", en: "Bars" },
				line: { ko: "선", en: "Lines" },
				area: { ko: "영역", en: "Areas" },
				pie: { ko: "원", en: "Pie" },
			},
		},
		title: { label: { ko: "제목", en: "Title" } },
	},
	holds: "blocks",
	children: ["table"],
	translate: { attrs: ["title"] },
	check: (block) =>
		chartData(block).notNumbers.length > 0
			? [{ level: "warn", message: { ko: "숫자가 아닌 칸", en: "A cell that is not a number" } }]
			: [],
	Site: Chart,
});

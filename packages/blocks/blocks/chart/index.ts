import { ChartColumn } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { Chart } from "./site";
import { errorLine, sample, words } from "./words";

/**
 * A chart (` ```chart `): the old block's text (`chart bar`, `x`, `series`, `data` …), read by its own parser (`dsl.ts`) and drawn as bars, lines,
 * areas or a pie (doc 18: the owner chose the old text over a table, 2026-11-14).
 */
export const chart = defineBlock({
	type: "chart",
	label: words.label,
	description: [
		"A chart, written in its own text (`source`). The first line is `chart bar` (or line, area, pie). Then, for bars, lines and areas:",
		"`x <field>` names the field of the points, and one `series <key> | <name> | chart-1` line per series (colours chart-1 to chart-5).",
		"For a pie: `label <field>` and `value <field>`. Options, one per line: `show-values`, `hide-grid`, `hide-y-axis`, `y-range <min> <max>`.",
		"Last a `data` line, then a header row and the rows, cells separated by `|`: `month | views`, `Jan | 1200`. Numbers are plain digits.",
	].join(" "),
	menu: "insert",
	attrs: z.object({ source: z.string() }),
	fields: { source: { label: words.source } },
	fence: { language: "chart", attr: "source" },
	holds: "nothing",
	starter: (language) => ({ attrs: { source: sample(language) } }),
	check: (block) => {
		const source = typeof block.attrs?.source === "string" ? block.attrs.source : "";
		const first = normalizeChartDsl(parseChartDsl(source)).errors[0];
		return first ? [{ level: "warn", message: { ko: errorLine(first, "ko"), en: errorLine(first, "en") } }] : [];
	},
	Site: Chart,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: ChartColumn,
});

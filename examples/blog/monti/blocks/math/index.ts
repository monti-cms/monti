import { Sigma } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { drawFormula, MathBlock } from "./site";
import { words } from "./words";

/** A formula (` ```math `, and `$$ … $$` when read): LaTeX that KaTeX draws (doc 18). */
export const math = defineBlock({
	type: "math",
	label: words.math,
	description: "A formula on a line of its own, in LaTeX (`source`, without $$), drawn by KaTeX.",
	menu: "insert",
	attrs: z.object({ source: z.string() }),
	fields: { source: { label: { ko: "수식", en: "Formula" } } },
	fence: { language: "math", attr: "source" },
	holds: "nothing",
	check: (block) =>
		typeof block.attrs?.source === "string" && "error" in drawFormula(block.attrs.source)
			? [{ level: "warn", message: { ko: "읽지 못한 수식", en: "A formula that does not read" } }]
			: [],
	Site: MathBlock,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: Sigma,
	starter: () => ({ attrs: { source: "" } }),
});

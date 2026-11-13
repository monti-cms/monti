import { defineMark, z } from "@monti-cms/core";
import { lazy } from "react";
import { TooltipMark } from "./site";
import { words } from "./words";

/** A tooltip (`:tooltip[words]{text="…"}`): a note on some words, shown when a reader points at them (doc 18). */
export const tooltip = defineMark({
	type: "tooltip",
	label: words.tooltip,
	description:
		"A short note on some words (`text`), shown when a reader points at them: an abbreviation spelled out, a term explained.",
	attrs: z.object({ text: z.string().min(1) }),
	fields: { text: { label: words.tooltipText } },
	Site: TooltipMark,
	// Its card in the format bar's ⋯, loaded in the admin the first time it opens.
	Editor: lazy(() => import("./editor")),
});

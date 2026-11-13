import { defineMark, z } from "@monti-cms/core";
import { TooltipMark } from "./site";

/** A tooltip (`:tooltip[words]{text="…"}`): a note on some words, shown when a reader points at them (doc 18). */
export const tooltip = defineMark({
	type: "tooltip",
	label: { ko: "툴팁", en: "Tooltip" },
	description:
		"A short note on some words (`text`), shown when a reader points at them: an abbreviation spelled out, a term explained.",
	attrs: z.object({ text: z.string().min(1) }),
	fields: { text: { label: { ko: "툴팁 글", en: "Tooltip text" } } },
	Site: TooltipMark,
});

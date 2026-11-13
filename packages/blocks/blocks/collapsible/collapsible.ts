import { defineBlock, z } from "@monti-cms/core";
import { Collapsible } from "./site";

/** A collapsible (`:::collapsible{title="…" defaultOpen}`): what a reader opens by its title (doc 18). */
export const collapsible = defineBlock({
	type: "collapsible",
	label: { ko: "접기", en: "Collapsible" },
	description:
		"A part a reader opens by its `title`, closed unless `defaultOpen` is true: details, an answer, a long log. It holds blocks.",
	menu: "insert",
	attrs: z.object({ title: z.string().optional(), defaultOpen: z.boolean().optional() }),
	fields: {
		title: { label: { ko: "제목", en: "Title" }, input: "text", placeholder: { ko: "펼치기", en: "Show more" } },
		defaultOpen: { label: { ko: "펼쳐 두기", en: "Open at first" }, input: "switch" },
	},
	holds: "blocks",
	translate: { attrs: ["title"] },
	Site: Collapsible,
});

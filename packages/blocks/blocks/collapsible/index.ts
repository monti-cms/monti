import { defineBlock, z } from "@monti-cms/core";
import { Collapsible } from "./site";
import { words } from "./words";

/** A collapsible (`:::collapsible{title="…" defaultOpen}`): what a reader opens by its title (doc 18). */
export const collapsible = defineBlock({
	type: "collapsible",
	label: words.collapsible,
	description:
		"A part a reader opens by its `title`, closed unless `defaultOpen` is true: details, an answer, a long log. It holds blocks.",
	menu: "insert",
	attrs: z.object({ title: z.string().optional(), defaultOpen: z.boolean().optional() }),
	fields: {
		title: { label: { ko: "제목", en: "Title" } },
		defaultOpen: { label: { ko: "펼쳐 두기", en: "Open at first" } },
	},
	holds: "blocks",
	translate: { attrs: ["title"] },
	Site: Collapsible,
});

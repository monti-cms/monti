import { CollapseAll } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
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
		title: { label: words.title },
		defaultOpen: { label: words.openAtFirst },
	},
	holds: "blocks",
	translate: { attrs: ["title"] },
	Site: Collapsible,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: CollapseAll,
});

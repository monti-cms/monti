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
	// TODO(refactor): drawing a block (Site, Editor and the other screen slots) is the site's job, not the CMS's.
	// Remove them from this definition when the blocks package is migrated (docs/refactor/blocks.md).
	Site: Collapsible,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: CollapseAll,
});

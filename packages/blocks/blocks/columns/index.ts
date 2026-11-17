import { Column as ColumnIcon } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { Column, Columns } from "./site";
import { words } from "./words";

/** Columns (`::::columns{widths="60,40"}` holding `:::column`): blocks side by side (doc 18). */
export const columns = defineBlock({
	type: "columns",
	label: words.columns,
	description:
		'Blocks side by side: two to four column blocks. `widths` is each column\'s share in percent, separated by commas ("60,40"); equal when left out. A narrow screen stacks them.',
	menu: "insert",
	attrs: z.object({ widths: z.string().optional() }),
	fields: { widths: { label: words.widths } },
	holds: "blocks",
	children: ["column"],
	// TODO(refactor): drawing a block (Site, Editor and the other screen slots) is the site's job, not the CMS's.
	// Remove them from this definition when the blocks package is migrated (docs/refactor/blocks.md).
	Site: Columns,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: ColumnIcon,
	starter: () => ({
		children: [
			{ type: "column", children: [{ type: "paragraph" }] },
			{ type: "column", children: [{ type: "paragraph" }] },
		],
	}),
});

/** One column of `columns`: the blocks it holds. */
export const column = defineBlock({
	type: "column",
	label: words.column,
	description: "One column of a columns block: the blocks in it.",
	holds: "blocks",
	// TODO(refactor): drawing a block (Site, Editor and the other screen slots) is the site's job, not the CMS's.
	// Remove them from this definition when the blocks package is migrated (docs/refactor/blocks.md).
	Site: Column,
});

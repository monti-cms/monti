import { defineBlock, z } from "@monti-cms/core";
import { Column, Columns } from "./site";

/** Columns (`::::columns{widths="60,40"}` holding `:::column`): blocks side by side (doc 18). */
export const columns = defineBlock({
	type: "columns",
	label: { ko: "단 나누기", en: "Columns" },
	description:
		'Blocks side by side: two to four column blocks. `widths` is each column\'s share in percent, separated by commas ("60,40"); equal when left out. A narrow screen stacks them.',
	menu: "insert",
	attrs: z.object({ widths: z.string().optional() }),
	fields: { widths: { label: { ko: "폭", en: "Widths" } } },
	holds: "blocks",
	children: ["column"],
	Site: Columns,
});

/** One column of `columns`: the blocks it holds. */
export const column = defineBlock({
	type: "column",
	label: { ko: "단", en: "Column" },
	description: "One column of a columns block: the blocks in it.",
	holds: "blocks",
	Site: Column,
});

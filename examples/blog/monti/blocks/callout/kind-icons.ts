/**
 * The Carbon glyph of each kind of callout: the one map. The editor's kind button draws these glyphs, and `pnpm gen:callout-icons` turns the same glyphs into
 * the masks of the title icon in `style.ts` (`icon-masks.generated.ts`), so the button and the title show one drawing per kind.
 */
export const KIND_ICONS = {
	note: "Pen",
	tip: "Idea",
	info: "Information",
	warning: "Warning",
	danger: "WarningAlt",
} as const;

/**
 * The least pressable height of a text control (a `TextButton`, a tab, a `FilterButton`, a drag handle): what shows keeps the words' own line, and an
 * invisible layer over it reaches up and down to at least `height-control-xs` (24px). Nothing around it moves (the height standard in tokens.md).
 */
export const HIT_AREA =
	"relative after:absolute after:inset-x-0 after:top-1/2 after:h-[max(100%,var(--monti-height-control-xs))] after:-translate-y-1/2 after:content-['']";

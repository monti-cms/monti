/**
 * The least pressable height of a text control (a `TextButton`, a tab, a `FilterButton`, a drag handle, a chip's ×): what shows keeps the words' own
 * line, and an invisible layer over it reaches up and down to at least `height-control-xs` (24px). Nothing around it moves (the height standard in
 * tokens.md). `HIT_LAYER` is the layer alone, for a thing that is placed already (`absolute`, or `relative` of its own).
 */
export const HIT_LAYER =
	"after:absolute after:inset-x-0 after:top-1/2 after:h-[max(100%,var(--monti-height-control-xs))] after:-translate-y-1/2 after:content-['']";

export const HIT_AREA = `relative ${HIT_LAYER}`;

/**
 * The same layer reaching 24px both across and along, for a small thing that is narrow both ways (a table's grip, 20 × 12): what shows keeps its own
 * look, and the pointer finds a 24 × 24 box around it.
 */
export const HIT_LAYER_BOX =
	"after:absolute after:top-1/2 after:left-1/2 after:h-[max(100%,var(--monti-height-control-xs))] after:w-[max(100%,var(--monti-height-control-xs))] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export const HIT_AREA_BOX = `relative ${HIT_LAYER_BOX}`;

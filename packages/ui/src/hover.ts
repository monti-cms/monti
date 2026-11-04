/**
 * The pointer over an underline field (an input, a select, a combobox, an affix, a textarea, a tag field): the whole field takes a flat tint
 * (`bg-muted`, no rounded corners) and its rule turns a step darker. Once the field has focus the ink rule says so instead, so the tint goes.
 */
export const FIELD_HOVER = "hover:not-focus-within:bg-monti-muted hover:not-focus-within:border-monti-strong";

/**
 * An underline field's room for that tint: 8px inside at each side, and the field reaching 8px out to the left, so the words stay on the line
 * of the label above. Its right end stays at the column's edge (the padding sits inside its width there): a field that reached out to the right
 * too would run past a scrolling column and give it a sideways scrollbar. A full-width field is `100% - 8px` wide plus its 16px of padding
 * (`box-content`), so it spans from 8px left of the column to the column's right edge; a fixed or fitted width keeps its own width.
 */
export const FIELD_INSET = "-ml-monti-8 box-content w-[calc(100%-8px)] px-monti-8";

/**
 * The pointer over a checkbox, or over the option row that holds it: a soft round halo (`bg-muted`) around the box, and an empty box's border a
 * step darker. Only the box answers, not the whole row.
 */
export const CHECK_HOVER =
	"hover:not-data-disabled:shadow-[0_0_0_5px_var(--monti-bg-muted)] hover:not-data-disabled:not-data-checked:border-(color:--monti-fg-muted)";

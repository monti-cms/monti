/**
 * The pointer over an underline field (an input, a select, a combobox, an affix, a textarea, a tag field): the whole field takes a flat tint
 * (`bg-muted`, no rounded corners) and its rule turns a step darker. Once the field has focus the ink rule says so instead, so the tint goes.
 */
export const FIELD_HOVER = "hover:not-focus-within:bg-monti-muted hover:not-focus-within:border-monti-strong";

/**
 * An underline field's room for that tint: 8px inside at each side. The field starts where its label starts; the words sit 8px in from both.
 */
export const FIELD_INSET = "px-monti-8";

/**
 * The pointer over a checkbox, or over the option row that holds it: a soft round halo (`bg-muted`) around the box, and an empty box's border a
 * step darker. Only the box answers, not the whole row.
 */
export const CHECK_HOVER =
	"hover:not-data-disabled:shadow-[0_0_0_5px_var(--monti-bg-muted)] hover:not-data-disabled:not-data-checked:border-(color:--monti-fg-muted)";

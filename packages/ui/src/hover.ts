/**
 * The pointer over an underline field (an input, a select, a combobox, an affix, a textarea, a tag field): the whole field takes a flat tint
 * (`bg-muted`, no rounded corners) and its rule turns a step darker. Once the field has focus the ink rule says so instead, so the tint goes;
 * a field that is off (or holds a part that is off) takes none.
 */
export const FIELD_HOVER =
	"hover:not-focus-within:not-disabled:not-data-disabled:not-has-[:disabled]:bg-monti-muted hover:not-focus-within:not-disabled:not-data-disabled:not-has-[:disabled]:border-monti-strong";

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

/**
 * The pointer over words that act (a text button, a list's filter): a flat tint around them, 8px at the sides and 4px above and below, drawn as
 * shadows so the line they stand in does not move. The keyboard's focus ring runs around that same room.
 */
export const TEXT_HOVER =
	"hover:not-disabled:not-aria-disabled:bg-monti-muted hover:not-disabled:not-aria-disabled:shadow-[-4px_0_0_4px_var(--monti-bg-muted),4px_0_0_4px_var(--monti-bg-muted)] focus-visible:shadow-[-4px_0_0_4px_var(--monti-bg-page),4px_0_0_4px_var(--monti-bg-page),-4px_0_0_6px_var(--monti-border-strong),4px_0_0_6px_var(--monti-border-strong)]";

/**
 * The control at an underline field's end (a regenerate button, a combobox's caret): pulled 8px into the field's padding, so a 32px icon button's
 * glyph sits 8px from the field's end, as the words sit 8px from its start. The button keeps its whole 32px to press.
 */
export const FIELD_ACTION = "-mr-monti-8 shrink-0";

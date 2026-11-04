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
 * The pointer over a checkbox, or over the option row that holds it: a soft round halo (`bg-selected`, a step stronger than a field's tint: no picked state shares it) around the box, and an empty box's border a
 * step darker. Only the box answers, not the whole row.
 */
export const CHECK_HOVER =
	"hover:not-data-disabled:shadow-[0_0_0_5px_var(--monti-bg-selected)] hover:not-data-disabled:not-data-checked:border-(color:--monti-fg-muted)";

/**
 * The pointer over words that act (a text button, a list's filter): a pill-shaped tint around them (one step darker, `bg-selected`, while pressed), 8px at the sides and 4px above and below, drawn as
 * shadows so the line they stand in does not move. The keyboard's focus ring runs around that same room.
 */
export const TEXT_HOVER =
	"hover:not-disabled:not-aria-disabled:bg-monti-muted hover:not-disabled:not-aria-disabled:shadow-[-4px_0_0_4px_var(--monti-bg-muted),4px_0_0_4px_var(--monti-bg-muted)] active:not-disabled:not-aria-disabled:bg-monti-selected active:not-disabled:not-aria-disabled:shadow-[-4px_0_0_4px_var(--monti-bg-selected),4px_0_0_4px_var(--monti-bg-selected)] focus-visible:shadow-[-4px_0_0_4px_var(--monti-bg-page),4px_0_0_4px_var(--monti-bg-page),-4px_0_0_6px_var(--monti-border-strong),4px_0_0_6px_var(--monti-border-strong)]";

/**
 * The control at an underline field's end (a regenerate button, a combobox's caret, the eye of a secret): one size under the field, so its round
 * ground stays inside the field's tint with 2px to spare above, below and at the end (a 36px field holds a 32px button, 32px a 28px one, 28px a
 * 24px one). It is pulled 6px into the field's 8px padding.
 */
export const FIELD_ACTION = "-mr-monti-6 shrink-0";

/** The button size under each field size, for {@link FIELD_ACTION}. */
export const FIELD_ACTION_SIZE = {
	lg: "",
	md: "[&_[data-slot=icon-button]]:size-monti-control-sm",
	sm: "[&_[data-slot=icon-button]]:size-monti-control-xs [&_[data-slot=icon-button]_svg]:size-3.5",
} as const;

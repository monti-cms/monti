/**
 * The pointer over an underline field (an input, a select, a combobox, an affix, a textarea, a tag field): the whole field takes a flat tint
 * (`bg-muted`, no rounded corners) and its underline shows (`border-default`; at rest a field has none). Once the field has focus the ink rule says so instead, so the tint goes;
 * a field that is off (or holds a part that is off) takes none, and neither does one that is only read (`readOnly`): nothing is typed in it. A rule that says a state (an error's red, a proposal's blue, on the field or on
 * the input in it) keeps its colour under the pointer: only the tint comes.
 */
export const FIELD_HOVER =
	"hover:not-focus-within:not-disabled:not-data-disabled:not-has-[:disabled]:not-aria-readonly:not-has-[[readonly]]:bg-monti-muted hover:not-focus-within:not-disabled:not-data-disabled:not-has-[:disabled]:not-aria-readonly:not-has-[[readonly]]:not-aria-invalid:not-has-[[aria-invalid=true]]:not-data-proposal:not-has-data-proposal:border-monti-default";

/**
 * An underline field's room for that tint: 8px inside at each side. The field starts where its label starts; the words sit 8px in from both (a
 * label column's field, a panel's row). In a stacked form (`FormField spacing="label"`: the settings pages and the API key dialog of the 2026-11
 * redesign, 시안 v7.1) the words start on the underline's start, with the label and the hint (no room before them), and the end keeps 4px so a
 * trailing control ({@link FIELD_ACTION}) still ends inside the line. Only the place sets it, never the state: nothing moves under the pointer or the focus.
 */
export const FIELD_INSET =
	"pl-[var(--monti-field-start,var(--monti-space-8))] pr-[var(--monti-field-end,var(--monti-space-8))]";

/** What a stacked form's field sets for {@link FIELD_INSET}: the words on the underline's start, 4px kept at the end. */
export const FIELD_INSET_STACKED = "[--monti-field-end:var(--monti-space-4)] [--monti-field-start:0px]";

/** Where a mark that stands before an underline field's words (a finder's magnifier) starts: at the words' own start, {@link FIELD_INSET}. */
export const FIELD_LEAD = "left-[var(--monti-field-start,var(--monti-space-8))]";

/**
 * The pointer over a checkbox, or over the option row that holds it: a soft round halo (`bg-selected`, a step stronger than a field's tint: no picked state shares it) around the box, and an empty box's border a
 * step darker. Only the box answers, not the whole row. A wrong box keeps its red line under the pointer (an error shows in every state).
 */
export const CHECK_HOVER =
	"hover:not-data-disabled:shadow-[0_0_0_5px_var(--monti-bg-selected)] hover:not-data-disabled:not-data-checked:not-aria-invalid:border-(color:--monti-fg-muted)";

/**
 * The pointer over words that act (a text button, a list's filter): a pill-shaped tint around them (one step darker, `bg-selected`, while pressed), 8px at the sides and 4px above and below, drawn as
 * shadows so the line they stand in does not move. The keyboard's focus ring runs around that same room.
 */
export const TEXT_HOVER =
	"hover:not-disabled:not-aria-disabled:bg-monti-muted hover:not-disabled:not-aria-disabled:shadow-[-4px_0_0_4px_var(--monti-bg-muted),4px_0_0_4px_var(--monti-bg-muted)] active:not-disabled:not-aria-disabled:bg-monti-selected active:not-disabled:not-aria-disabled:shadow-[-4px_0_0_4px_var(--monti-bg-selected),4px_0_0_4px_var(--monti-bg-selected)] focus-visible:shadow-[-4px_0_0_4px_var(--monti-bg-page),4px_0_0_4px_var(--monti-bg-page),-4px_0_0_6px_color-mix(in_srgb,var(--monti-border-contrast)_60%,var(--monti-bg-page)),4px_0_0_6px_color-mix(in_srgb,var(--monti-border-contrast)_60%,var(--monti-bg-page))]";

/**
 * The control at an underline field's end (a regenerate button, a combobox's caret, the eye of a secret): 24px in a 32px field (28px in a 36px one,
 * 24px in a 28px one), so its ground stays inside the field's tint, and 4px from the field's end (pulled 4px into the field's 8px padding): every
 * trailing icon of a panel stands on one vertical line.
 */
export const FIELD_ACTION = "-mr-monti-4 shrink-0";

/**
 * The icon button size under each field size, for {@link FIELD_ACTION}: the field gives it to the buttons in its end control (`IconButtonContext`), so a
 * caller passes a plain `IconButton`.
 */
export const FIELD_ACTION_BUTTON = {
	lg: { size: "sm" },
	md: { size: "xs" },
	sm: { size: "xs" },
} as const;

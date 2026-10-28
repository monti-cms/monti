# Choice

This page covers the controls for choosing among fixed things: checkbox and radio, the switch, and the short one-of-a-few choice.

An on state is shown by shape as well as color: a ✓, a filled circle, a knob on the right.

## Checkbox and radio

- A checked checkbox holds a ✓. The state is never carried by color alone.
- A list row's checkbox shows only when the pointer is over the row or when any row is picked.
- A radio is for a pick-one handling, such as "move the values" or "start with a new field".
- A checkbox is 14px (`.mt-check`). The partly-on state (`.is-mixed`) draws a bar instead of the ✓ and is used for select-all and for "some rows have it".

### In code

`Checkbox` (14px; a ✓ when on; `indeterminate` for the bar; `proposal` marks a choice the assistant made and nobody has touched, with the same mark in blue; an invalid checkbox keeps a red ring). `RadioGroup` with `RadioItem` rows (a filled ring when picked, an optional mono note at the end of the row, such as "148 posts", a plain `description` right after the label that says what the choice is ("문서 · 게시글, 노트처럼 본문이 있어요" in the kind of a new collection), and an optional `control` at the far end: the select of "move to another field"). `Option` lays out a row of a control, its text and a note; pressing the text presses the control, and `spread` pushes the control to the far end.

## Switch

An on/off setting that takes effect at once. Inside a form that has its own save button it keeps the same look.

### In code

`Switch` (34 by 20: the knob sits left when off and right when on). `proposal` makes the track blue for a setting the assistant turned on and nobody has touched.

## One of a few

A short choice of one among a few. Example: the language setting "모두 같음" (all the same) / "언어마다" (per language) / "원문 따름" (follow the source).

### In code

`Segmented`: joined cells in a thin rounded frame; the picked cell is on the selected background at 600. `size="sm"` is for panels and filter rows; `inline` makes it as wide as its cells. A `tool` ground variant is for tool surfaces (the sidebar), where the selected ground is the hover and the pressed cell takes the current ground. The DS README names this part `ToggleGroup`; that is only the Base UI primitive underneath.

## Choices of a select (`OptionTable`)

The choices of a select field, in the sheet that adds or edits a field: a small table with a head (값 in mono, 라벨), one row per choice and "+ 선택지" under it. The value is what is stored (mono) and the label is what the writer sees; both read as text until pressed. A row has a grip to reorder it by and a × to take it out. The default is picked in a quiet menu at the end of the line ("기본값 · 메모 ▾").

### In code

`OptionTable` (`valueLabel`, `labelLabel`) with `OptionRow` rows (`value`, `label`, `handle` with an `OptionRowHandle`, `action`, `drag` for the sortable's transform).

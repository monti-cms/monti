# Primitives

This page covers the small parts every other part is made of: the layout pieces (`Box`, `Stack`, `Inline`), text (`Text`, `Heading`), the icon (`Icon`), the form label (`Label`), the rule between things (`Separator`), the words the parts write themselves (`UiLabelsProvider`) and the column the person can widen (`ResizablePane`). They have no look of their own beyond the tokens: colors, type, spacing and sizes are in [tokens.md](tokens.md). A screen arranges and writes with these parts and never writes a class; anything they cannot say belongs in a part of its own.

## Layout (`.mt-stack`)

A box holds children, and nothing else. All the options are token names, so a gap, a padding or a width can only be a step of the scale.

- `Box` has layout options only (padding, surface, border, radius, size, overflow). For a row or a column of children use `Stack` or `Inline`, which take the same options.
- `Stack` lays out children in a column (or a row). The gap is a step of the spacing scale in px: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40 or 48. It is 12 by default.
- `Inline` is a `Stack` in a row, centered on the cross axis by default: an icon and its label, a toolbar.
- A row or box that needs something the options do not say (a value that has no token) is not given a class: it becomes a part.

### In code

`Box`, `Stack` and `Inline` share the options of `LAYOUT` (`packages/ui/src/layout.ts`), which `Grid` shares too: `padding={16}`, `background="tool"`, `radius="lg"`, `width="sheet"`. They take no `className` or `style`.

## Text

Text is always in one of the type roles of [tokens.md](tokens.md), which set the size, the line height and the weight together. A role is never rebuilt from a size and a weight.

- `Text` takes a role as `variant` (`micro`, `meta`, `caption`, `note`, `label`, `body`, `title`, `reading`, `heading`, `page`, `display`) and a color by meaning as `tone` (`default`, `muted`, `subtle`, `faint`, `proposal`, `danger`, `warning`, `success`).
- `weight` only emphasizes a run inside its role (`medium`, `semibold`). Controls (buttons, inputs, menus) already carry their role and take plain text.
- A `Text` inside another text that has a role, with no `variant` of its own, takes the outer role instead of `body`: a heading's run keeps the heading size and a caption's bold word stays caption-sized.
- `Heading` is a heading in a heading role: `title` for sections, panels and dialogs (the default), `page` for the screen's title, `heading` for a heading inside a text, `display` for the entry title, and `label` for a small heading inside a panel or sheet.
- `Text` can also cut a long line with "…" (`truncate`, or `lines` of 2 or 3), keep the text's own line breaks (`preserveLines`) and be read by screen readers only (`srOnly`).

### In code

`Text` (`variant`, `tone`, `weight`, `mono`, `truncate`, `lines`, `italic`, `preserveLines`, `align`, `srOnly`) and `Heading` (`as` is `h1` to `h4`, `variant` is the role).

## Icon

An icon outside a button: a severity mark, a file type, a hint. The icon sizes and the choice of glyph are in [tokens.md](tokens.md).

- Sized by name, 12, 14, 16 (the default) or 20px, and colored by `tone` (muted, subtle, danger, warning or success); with no tone it follows the text beside it.
- It is decorative unless it has a `label`, which makes it an image with that name.

### In code

`Icon`: `icon` is the glyph (a Carbon icon, or `Spark` for the assistant), `size` is `xs`, `sm`, `md` or `lg`, `tone`, and `label`.

## Form label (`.mt-label`)

The name above a field: mono 11 in the subtle ink (the `micro` role). The field page covers how a label sits in a form (see Field).

- `size` and `tone` pick another role for a label that reads as text, such as a checkbox's. `hidden` keeps the label for screen readers only.
- `required` ends the label with a red `*`, 2px after the text, for a form that also has optional fields. A form whose every field is required, and a select that always holds a value, get no mark. The star is decorative: the control itself carries `required`.

### In code

`Label`: `size`, `tone`, `hidden`, `required`. For a labeled field use `FormField` and `FormFieldLabel` (see Field).

## Separator (`.mt-line`, `.mt-vr`)

A line between rows or between controls.

- A horizontal line is 1px. A line between rows is the quiet row line (`border-muted`).
- A vertical rule between two controls in a toolbar is the 1 by 14px `border-default` rule, centered.

### In code

`Separator`: `orientation` is `horizontal` (the default) or `vertical`. For a vertical one, `length="full"` stretches to the row and `length="control"` is the 14px rule centered in a toolbar.

## Words the parts write (`UiLabelsProvider`)

A few parts write words themselves: a screen reader name or a default button label (such as close, clear, cancel, save, loading and the pagination words). They are English by default. An app passes its own language through the provider, so the design system never depends on a translation library.

### In code

`UiLabelsProvider` takes `labels`, any part of `UiLabels`; the admin passes them from its message dictionaries (`AdminUiLabels`). `useUiLabels` reads them and `DEFAULT_UI_LABELS` holds the English defaults.

## Resizable column

A column whose width the person can change: a list beside its detail. The handle is on one edge and a hairline is on the other side of it. The width is remembered, and a pane has a smallest and a largest width.

### In code

`ResizablePane`: `resizeKey` names the remembered width (the same key in two places shares one width), `defaultWidth`, `min` and `max` are in px, `label` names the handle, and `edge` is the side of the handle (`end`, the default, is the right edge). The master-detail screens use it for their list.

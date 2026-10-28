# Field

This page covers the controls where a value is typed or picked: inputs, selects, fixed-end fields, the search box, the calendar, secret values, and the rules for required and read-only values.

Every field has a single underline. The label is above in mono 11px, and the error is one line below.

## Single line

An input with one underline. Box borders are not used.

- The label is above the field in mono 11px (`text-micro`, `fg-subtle`).
- A text button at the end of the label row ("되돌리기" (undo), "버리기" (discard), "✦ 채우기" (✦ fill)) does not exceed the label row's height (14px). When a field changes and a button appears, the field below does not move.
- Focus: the underline turns ink (`border-contrast`).
- Error: the underline is `fg-danger`, and one line of error text is below (what is wrong and how to fix it).
- Several errors are not spaced apart (`.mt-errors`). No gap is wider than the 2px between the field and its error. The same sentence appears once; if there is one, it is plain text, and if there are several each line gets a dot.
- The placeholder is `fg-faint`. No explanation text is hung below a field.
- Values that a machine reads, such as an address or an identifier, are mono (`.mt-input.mt-mono`). The mono rule wins, so `font: inherit` on the input does not turn the font back.

### In code

`Input` (an underline, never a box; ink on focus, danger when `aria-invalid`; `proposal` marks a value the assistant wrote and nobody has touched, in blue text with a 1.5px blue underline). `size="sm"` is 28px, for toolbars, filters and tables; `mono` is fixed-width letters; `inline` reads as text until focused, with no line at all (a name edited in place). `FormField` lays out a labeled field: the label above (mono 11), the control, then at most one line of error. The assistant's fill action sits on the label row (`FormFieldLabel action`) and shows only while the pointer or keyboard is in this field. The parts are `FormField`, `FormFieldLabel`, `FormFieldError`, `FormFieldDescription`, `FormFieldTitle`, `FormFieldGroup`, `FormFieldSet` and `FormFieldLegend`.

## Multiple lines

A multi-line input. It has the same underline look as `Input`. Used for tone rules, field descriptions and alternative text.

### In code

`Textarea`: `size="sm"` writes at the note size for compact panels; `mono` is for code and source text; `proposal` marks text the assistant wrote.

## Select

A select has a chevron icon (14px, `fg-subtle`) at the right end of the underline. The text character ▾ is not used. When there are many items (language codes, time zones), it opens as a Combobox that can search.

### In code

`Select` (its `items` prop is required: every value with its label, so the closed trigger shows the label) and `Combobox`. `SelectTrigger` takes `width`: `full` in a form, `fit` in a toolbar or filter. `proposal` marks a value the assistant picked.

## Fields with fixed ends (`.mt-affix`)

Only the part that can be changed is an input. The ends are fixed in dimmed mono text, so it reads as one address.

- The underline is under the changeable part only. The fixed parts (`/`, `/:slug`) are dimmed text with no line.
- Pressing anywhere in the field (the fixed text or empty space) puts the caret at the end of the changeable part.
- Focus, error and proposal colors apply to that underline only (ink, `fg-danger`, blue 1.5px). The fixed text does not change color.
- The changeable part is only as wide as its text. Even when empty it keeps three characters of width (`3ch`), so a line is there to press.
- The public address: `/` + `posts` + `/:slug`. `:slug` cannot be deleted, so an error like "`:slug` is missing" cannot happen.
- A collection without pages turns it off with a switch above the field.

### In code

`Affix`: `prefix` and `suffix` are the fixed texts; `action` is a control at the far end of the line (a regenerate button).

## Fold-out mark (`.mt-caret`)

A chevron icon after a text button that opens a list (filter, sort, changed places, move to folder, pick a model). 12px, `fg-subtle`, 6px from the text and centered on it (checked by measuring). A button that holds only the chevron (the publish split button, expand) uses `.mt-caret--solo`, which removes the margin. On a dark ground such as the publish split button, it follows the text color. The text character ▾ is too small and looks like decoration, so it is not used.

### In code

`Caret` (`solo`, `ink`).

## Match row (`.mt-map`, `.mt-map-row`)

The row in an import that connects a key of the file to a field. The key is at the left (mono), → in the middle, and a `.mt-select` at the right, with one line under it: an example value (`.ex`, dimmed) or a note (`.warn`, orange). A key that is not imported is `.is-off` (the key is dimmed). A select that ✦ matched is `.mt-select.is-ai` (blue). A summary table (the restore preview) uses the same row as two columns.

### In code

`MapRow`: `name` (the key), `example`, `warning` (a note in the warning color that replaces the example), `off`, and the `Select` that picks the field as its child. Give the select `proposal` when the assistant matched it.

## Search box (`.mt-searchbox`)

A pill that opens in place when the page's "검색" (search) is pressed. At the front, `.target` picks where to look ("전체" (everything, the default) · "제목" (title) · "주소" (address) · "본문" (body)), then the magnifier, the search words and ×. While it is open, the filter row does not repeat the same words as a chip. Example: an import result's "-2를 붙인 2편 보기" (see the 2 posts with -2 added) opens the list with the place "주소" and the words "-2".

### In code

`SearchBox`: `targets` (the places to look) is optional; without it there is no picker.

## Calendar (`.mt-cal`)

Used only in a list filter's date › "기간 고르기" (pick a period). One month, 7 rows of 32px cells, weekdays in mono 11 `fg-subtle`. Days outside this month are `fg-faint`, today has a thin border, the picked day is a black cell, and the days between are a `bg-selected` band. The head shows "2026년 10월" (October 2026) and ‹ › to move.

- In the list filter's date › pick a period, the calendar opens in a card beside the date menu. The first day pressed is the start and the next is the end. The moment the end is pressed the filter is applied and the calendar closes. Pressing the same day twice means that one day. The applied period shows as a chip ("수정한 날: 10. 05 – 10. 16" (edited date: 10. 05 – 10. 16)).

### In code

`Calendar` (a month grid for a day or a range) and `CalendarDayButton`.

## Line under the field (`.mt-note`)

A line that is not an error (13px, `fg-subtle`). It says only why a field appeared, or what was filled in instead. Example: the name field of "add a key" is always filled with the service name. If a key with that name already exists, it is filled as "Anthropic 2" and below it reads "이름이 Anthropic인 키가 이미 있어요." (A key named Anthropic already exists.)

## Secret value field (`.mt-secret`)

A field for a value that is entered hidden, such as an API key. Under one underline are the input and an eye button (24px, `fg-subtle`). Pressing the eye shows the value just entered, pressing again hides it (names: "키 보기" (show key) / "키 가리기" (hide key)). A saved key is never shown again (only "··· a1b2"). There is no clear × : to fix a pasted value, empty the field. With two buttons the end of the field would be crowded.

## Saved value row (`.mt-value`)

The place to change a value that is never shown again (a saved key). Instead of a field it shows a trace of the current value (`··· a1b2`, mono) and one text button at the end ("바꾸기" (change)).

- Its height and text position are the same as an input (33px, 6px from the top), so when "바꾸기" opens the field (`.mt-secret`), nothing below moves.
- The quiet "그대로" (keep) at the end of the open field (`.mt-secret > .mt-text-btn`) goes back to this row and leaves the value as it is. It is not called "취소" so it does not collide with the "취소" under the window. Leaving it empty keeps the value as it is.
- When the value cannot be read, the field is open from the start, with one `.mt-note` line below and without "그대로".

## Required fields (`.mt-label > .req`)

In a form where at least one field may be left empty, a red `*` goes at the end of the label of each required field (the field has `required`). It is not added to a field that always has a value (a select) or to a short form where every field is required (login, the first admin). A field that may be empty says so in its placeholder (for example the key of an OpenAI-compatible address: "없음" (none)).

## Read only

On a deployed site without the GitHub plugin, the settings that live in the file (`monti.schema.ts`), that is, the structure, are locked. The structure is what the site's code (routes, components, types) or the shape of saved data depends on. The rest (the admin settings) is in the database and can be edited anywhere (no lock and no dimmed switch). A section that mixes structure and admin settings is split in two (for example the collection's default tab: "보기" (view) and "구조" (structure)).

- A locked value is shown as text without a field (the same look as an identifier field).
- The lock goes once after the title (`h2`) of a section that is entirely structure, not after a value or a field label (12px `fg-faint`, centered on the title text, 6px away). When one list with no section title is entirely structure, one lock goes after the name of the tab that points to it. A value that can never be changed (an identifier) gets a lock right after the value, separately from this rule.
- A switch in a locked section stays and is dimmed (`.mt-switch[aria-disabled="true"]`).
- The drag handle, + add and × of a locked list are hidden, and their space is removed too, so the lines move to the left (`.mt-tree.is-readonly` for a field list, `.mt-ftabs.is-readonly` for group tabs). No banner or explanation sentence is added.

# Tabs

This page covers the two ways to show a view or a condition in place: tabs for switching views, and chips for filters that are on.

A tab is underlined text. A filter that is on is a chip.

## Tabs

Underlined text tabs. Language tabs, status tabs, settings sections and the properties panel tabs all use this shape.

- The picked tab is ink at 600 with a 1.5px ink underline. The others are `fg-subtle`. Tabs are 13px with 20px between them (`space-20`).
- Tabs in the filter row under a page title (`mt-toolbar`) differ: 14px, the picked tab is 700, and there is no underline. One heavy line under the title is enough.
- A count goes next to the name in mono ("전체 148" (all 148)).
- At the very top of a pane (`mt-tabs--bar`, height `height-panebar`, 44px, 24px side padding) the underline sits on the pane's own rule.
- A tab with something to deal with gets a dot after its name: warning is `fg-warning`, an AI proposal is `fg-proposal`. See the change dot in the Status page.
- Underlined tabs are for the top of a pane and for language tabs. Under a page title use the bold-only form.

### In code

`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. `TabsList` has `variant`: `line` (the default), `bar` (the top of a pane; `inset` lines up the first tab with the content's side padding) and `toolbar` (under a page title). A tab can carry a mono count (a `warning` tone for a count that needs attention, such as failed deliveries) and a `ChangeDot`.

`TabLinks` and `TabLink` do the same for pages that are links, such as the pages of one tool page in the filter row under a title.

`FolderTabs` is another kind of tab, for a list of fields split into pages. It is described in the List page, under the field outline.

## Chip

A filter that is on, or a condition that was picked. A × on the right removes it.

- A chip is 28px high (`height-control-sm`), 13px at 600, on `bg-selected`, with 10px side padding.
- The filters that are on appear as chips in a row under the page title. See the List page.
- An AI-set chip is blue with a ✦ in front. See the Proposal page.

### In code

`Chip` (`onRemove` adds the ×, `removeLabel` names it for screen readers, `proposal` is the AI-set look) and `ChipRow` (the row under a title, 12px inside like the rows, with the toolbar rule under it; with no filter on there is no row). `FilterButton` is a condition that is not on yet: its name and a caret that opens a list of values; once a value is picked it becomes a `Chip`.

The DS README names the chip part `Badge(filter)`. No such export exists.

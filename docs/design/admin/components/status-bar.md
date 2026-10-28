# Status bar

This page covers the bar under the editor, the list that opens above a cell, and how plugins fill cells.

## Bar

The bar under the editor. It holds as cells only information that is not anywhere else: to-dos, requests, character count. When there is nothing, it is hidden.

- A cell fills the full height (the pressing area). The separator between cells is only 14px in the middle.
- An open cell is `bg-selected`, and a panel opens above it.
- The bar is `height-statusbar` (30px) on the tool ground, with a rule above it, in mono 12px `fg-subtle`.

### In code

`StatusBar` is as tall as the design says, takes the tool color, and is not drawn at all while it has no cell. Name it with `aria-label`. `StatusBarCell` is as tall as the bar, so the whole height can be pressed; the cell whose list is open takes the selected background. It is a `<button>` by default (render it from the list's trigger); give it `render={<span />}` for a cell that only states something, or an `href` (or the app's router link in `render`) for one that goes somewhere. `tone` colors the text of something to fix, and `dot` (on by default) puts the 6px dot before it: the dot marks what has to be dealt with before saving or publishing. Cells with `end` sit after the spacer (`StatusBarSpacer`), with the rule on their left, and they hide first on a narrow screen. `StatusBarAnnouncer` says the bar's state aloud, politely, without showing it, for a cell whose text changes in ways that should not be read out each time.

## When a cell is opened

Pressing a cell opens a list panel above it (`.mt-card.mt-statusbar-list`). Everything that is a "list of places to fix", such as to-dos or changed places in the source, uses this one panel.

- At the top, the group name and a count (`.mt-menu-label`).
- A row (`.mt-todo-item`): a mark in front (an orange circle, or a mark for changed / new / removed) · the title at 14 · where it is, one line of gray at 12 · one thing to do at the right end ("✦ 채우기" (✦ fill), "✦ 번역" (✦ translate), "지우기" (delete)). Pressing the row goes to that place.
- Things already done go below as ✓ rows (`.mt-todo-done`).
- What blocks publishing is gathered in one cell, "할 일" (to do). A dimmed block of a translation is a to-do too. A notice that does not block (the source changed) has a cell of its own.

### In code

`StatusBarList`: opens upward from a status bar cell. A card with the group's name (`label`) and the count (`count`) in the head (no count once nothing is left; `countTone` is `danger` while any row blocks publishing), then rows to do (`TodoItem`) and rows already done (`TodoDone`), and under a rule the actions that belong to the whole list (`footer`: a link to its settings, "모두 고치기" (fix all)). `trigger` is the cell that opens it.

`TodoItem`: a ring, the title, one short line under it, and the one action at the right. `blocking` draws the ring in red for what stops publishing; the others are warning-colored. `marker` replaces the ring with a `Marker` (a translated block whose source changed). `current` is the row whose place is open on the page. `proposal` puts a spark in front of the action and makes it blue: the assistant does it. With `onOpen` the title and the line are a button that stretches over the row and goes to the place. `TodoDone` is a thing that is already right: a green ✓ and one small line, under the rows to fix, set off by a rule.

## Plugin cells

A plugin does not bring its own UI. It fills the cell and the panel that core gives it: the cell's name and count ("맞춤법 2" (spelling 2)), the panel's rows (what → how · where), one thing to do in each row ("고치기" (fix)), and at the bottom of the panel "설정" (settings: goes to the plugin's settings) and "모두 고치기" (fix all). The place for the cell is in both the source and the translation editors; the plugin decides whether to show it (a plugin that checks only Korean has no cell on an English entry).

- A row that blocks is marked with a red circle (`.mark.is-danger`), like "고칠 곳" (places to fix) in the schema preview, which blocks saving.

### In code

`StatusBarPluginCell` fills a cell for a plugin.

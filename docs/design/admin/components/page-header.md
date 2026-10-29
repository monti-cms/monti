# Page header

This page covers the top of a content page: the title row with its ink rule, the toolbar under it, and how page width behaves on wide windows.

When rows are picked, the toolbar stays as it is. The bulk bar takes the place of the column-name row below it (see List).

## Title row

The head of a content page. The title (`text-page`) has an ink rule under it. This is the only place a page has this rule.

- Beside the title: only the address rule of that list, in mono (`/posts/:slug`). Settings screens do not have it. The name of the file to save (`monti.schema.ts`) shows only where that file is the problem, such as the save review and the read-only notice.
- The title row is as tall as a pill (36px), whether or not there is a pill. So the ink rule is at the same height on every page (it does not move down when the save group appears).
- At the right: secondary pill first, then primary pill. On a settings screen the save group goes here ("바뀐 곳 N ▾" (N changed places) · "모두 되돌리기" (undo all) · "저장하고 적용" (save and apply)), and it follows when the page scrolls.

### In code

`PageHeader`: `title`, `meta` (the address rule, mono, beside the title), `children` (the actions at the right: the secondary pill first and the one primary pill last) and `trail` (the way back above the title, such as a folder path). The title is 26px bold. `PageColumn` is the column every page sits in: centered, 40px above the title and below the page, 48px at the sides (16px on a narrow screen). It takes the height the page has; the header and the toolbar keep their place, and `PageBody` is what scrolls. `Section` is one section of a settings screen: the title in a column on the left, the fields beside it, and a hairline under; the fields wrap under the title on a narrow screen (`stacked` always puts them under it, for a section in a column that is already narrow: a collection's basics). `id` is the anchor a link can land on. `ChangesGroup` is the save group of a settings screen: "바뀐 곳 N ▾" opens the list of changes, each with its own undo, then "모두 되돌리기" and the one primary pill; the pill is disabled, not hidden, while something blocks saving, and the list hangs from the whole group with its right edge on the group's.

## Toolbar

The row under the title (height `height-toolbar`, 48px). What it holds differs by screen. Picking rows does not change it. The bulk bar appears in the column-name row.

- A collection list: nothing, so the column-name row sits directly under the title row; filters that are on show as the dot after a column's name, not as chips. Only a search inside a folder adds the search-place row (`.mt-chips`). There are no status tabs, no "필터 ▾" (filter) and no "보기 ▾" (view); filtering, sorting and columns are done from the column names (see List).
- The trash mixes kinds, but it has no kind tabs either: its one column-name row is "제목 · 종류 · 버린 날" (title · kind · discarded), and the "종류" column's menu filters by kind ("게시글" (posts) · "메모" (memos) · "카테고리" · "태그" · "미디어", with counts, several at once). Sorting is done from the column names there too.
- Between the left group and the right group is a short vertical rule.

### In code

`PageToolbar` (and `PageToolbarEnd` for the right group, `ToolbarDivider` for the short rule). There is no chip row part: filters show as the dot after a column's name.

## Wide windows

The mockups are drawn at 1440x900. In a wider window the column width depends on the kind of screen.

- List screens (entry list, media, trash, the tables of tools): they grow by the amount that leaves at least 240px on each side, up to `width-list` (1200px). At 1440 the column stays 880, at 1920 it is 1200. When the column gets wider, the title column grows and media fit more per row.
- Settings and input screens (the four settings tabs, template editing, add a key: screens that fill in fields): always `width-content` (880px). So that labels do not drift from their values and lines do not get long.
- When a side surface is open, the same rule is followed again with the room that is left.

### In code

`PageColumn` has `width="content"` (the default, 880px) or `width="list"` (880px until the page area leaves at least 240px on each side, then it grows with the area up to 1200px). The area is what is beside the sidebar and any docked panel, measured on the nearest `container` (the admin frame makes it), so a folded rail or an open panel runs the same rule on the room that is left.

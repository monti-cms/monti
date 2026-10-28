# List

This page covers how lists of items are shown: list rows, the column menu, the bulk bar, the media grid, drop targets, empty states, the field outline, folders, pagination and the language list.

## List rows

A list row sits on a fixed-column grid, so a long title is cut and columns do not drift. A CMS list is a table, not a reading screen, so there is a column-name row at the top.

### Column-name row

- The column-name row (`.mt-list-head`) uses the same grid as the rows. It is 40px high with the same pale line under it as the rows. A name is `.mt-col` (`text-caption`, `fg-subtle`, weight 400). The ⋯ column and the checkbox column have no name.
- There are no status tabs, no "필터 ▾" (filter) and no "보기 ▾" (view) above the list. Filtering, sorting and hiding columns are all done from the name of that column. There is one place for each job, so filtering by status is also done from the status column's name. A name is a button (`.mt-col`, wrapped in `.mt-col-wrap`). Pressing it opens that column's menu (`.mt-col-menu`, 220px) under the name. The text of the menu rows starts on the same vertical line as the name. The last column (the date, `.is-end`) and columns near the right edge (`.is-flip`) align the menu's right edge instead.
- A column with a filter on has a 5px ink dot (`.dot`) after its name. A column whose menu is open has its name in ink (`.is-open`).
- Filters that are on are not repeated as chips. The dot after the column's name and the ticks in its menu show them, and unticking in the menu removes one. A chip row would only say the same again and push the list down as it comes and goes. The search words stay in the search box and are not a chip either. Only a search inside a folder adds one row under the title row (`.mt-chips`): the place to search, "시리즈 원고" (series drafts) · "모든 폴더" (all folders).

### Column menu

From the top: sort | values to filter by | hide column. A part that does not apply is left out, and there are rules between the parts.

- **Sort** is only in columns that can be sorted: title, address, edited date, published date, created date. Title and address have ascending / descending; dates have "최근부터" (newest first) / "오래전부터" (oldest first). The current value has a ✓. Picking applies at once and closes the menu. A sorted column has its name in ink (`.mt-col.is-sort`) and a 12px ↓ (descending) or ↑ (ascending) after it.
- **Filter values** are check rows and a post count. Turning on several means any of them (OR); different columns combine as all of them (AND). The menu stays open after a pick, so several can be applied at once. By column kind:
  - Status: "발행됨" (published) · "수정 중" (editing) · "초안" (draft) · "보관됨" (archived).
  - Relation (category, tag): a search row at the top, "없음" (none), a rule, then the items.
  - Select field: "없음", a rule, the options.
  - Language: the languages, a rule, a "번역" (translation) label, then "번역 없음" (no translation) · "원문 바뀜" (source changed) · "최신" (up to date).
  - Date: "오늘" (today) · "최근 7일" (last 7 days) · "최근 30일" (last 30 days) · "기간 고르기" (pick a period). Only one at a time (✓). "기간 고르기" opens a calendar beside it. The days from the first one pressed to the next one pressed are applied, and the calendar shows that period and stays open.
  - Text field or image field (summary, search description, share image …): a single "비어 있음" (empty).
  - Title and address have no filter values (find them by search).
- **Hide column**. The title does not have it (it is always shown).

The table below sums up the filter values by stored kind, which is what decides them.

### Filter values by stored kind

The filter values in a column menu follow the kind of value that is stored, not the shape of the input. A custom field with its input replaced (`input`) follows the same rule.

| Stored kind | Filter values in the column menu |
|---|---|
| Status | "발행됨" · "수정 중" · "초안" · "보관됨" |
| Language | One row per language, a rule, then the translation: "번역 없음" · "원문 바뀜" · "최신" |
| Date (edited, published, created) | "오늘" · "최근 7일" · "최근 30일" · "기간 고르기" (one at a time) |
| Select | "없음" · one row per option |
| Relation | search row · "없음" · one row per item |
| Text, media | a single "비어 있음" (there is no "채워짐" (filled)) |
| Title, address | none (find by search); sort only |
| Screen-only, back-reference | no filter values in the column menu |
| Conditional | the fields inside each follow this rule |

- If the column to filter is hidden, turn it on first with the +. Once on, the filtered result shows in that column right away.
- Picking a value does not close the menu (several are applied at once). The period calendar also applies the period when the second day is pressed, and stays open showing the picked period. Esc or a press outside closes it. An applied filter shows at once as the dot after the column's name.
- Sort is chosen at the top of the column menu. The title mixes Korean and English, so it is not called "가나다순" (alphabetical in Korean); it is "오름차순 · 내림차순" (ascending · descending). The English admin says "A → Z · Z → A", and for dates "Newest first · Oldest first". The order of titles follows the sort rules of the admin screen language.
- Folders are filtered by the sidebar, so they are not in the column menu.

### Adding and ordering columns

- Above the ⋯, in the name row, is a 24px + (`.mt-col-add`, named "열 추가" (add column)). The + and the row's ⋯ share the same end column, so the center of the + is on the same vertical line as the center of the ⋯ (it is 6px inside the row's inner padding). There is no separate margin at the right. Pressing it lists only the columns that are hidden now, as rows without checks (no visible columns, and no list label). Picking one makes the column, and that row leaves the list. If no column is hidden, there is no +. To filter by a text field, turn that column on here first.
- The number per page (25 · 50 · 100) is `25개씩 ▾` (25 per page; `.mt-per-page`, mono 12px) beside the range below. It opens upward, and picking closes it.
- Column order is changed in the name row, for all columns including the title. Press a name and drag sideways: the name is lifted (`.mt-col.is-held`: `bg-selected` + `shadow-floating`) and follows the pointer, and the other columns make room, both in the name row and in the rows, so the new order is visible at once. Letting go saves it. With the keyboard, focus a name and press Alt + ←→. The title can be moved but cannot be dragged away (hidden).
- The default order of a document collection: status · title · one column per classification field (category, tag …) · language · edited date · ⋯. There is no month group column ("10월" (October)).

### Status column and folder rows

- The status column shows every status. "발행됨" is written too, in the quiet color (`.mt-status--quiet`), so the first column is not empty.
- A folder row (`.mt-row-folder`) leaves the status column empty. A 16px folder icon is at the very front of the title column, 8px later the name, then the post count ("글 2" (2 posts), mono `fg-faint`). "상위 폴더로" (up one folder) and the new-folder row for typing a name look the same. So a folder name starts further in than a post title by one icon and the gap.
- A column that gets cut (relation columns like tags, text fields) gives its block box `min-width: 0`, `white-space: nowrap`, `overflow: hidden` and `text-overflow: ellipsis`. A flex box ignores `text-overflow` and so cuts in the middle of a letter, so do not hide such a column in flex and let it go unseen. The end is always …, and to read it all use the cell's `title`.

### Row content

- The title is `text-body` (14 / 400) in ink, with the address under it in mono `fg-faint`.
- Pressing anywhere on a row opens that item. The title is a link that covers the whole row, so the title need not be pressed exactly. The checkbox and the ⋯ sit above it and are pressed separately.
- The ⋯ is always shown. The checkbox is shown only when the pointer is over the row and on picked rows. The checkbox hangs in the left outer margin of the table (-26px). The scrolling box of the list reaches 32px further into the left margin, so the checkbox is not cut and no horizontal scroll appears.
- The ⋯ column is 54px (the 32px button and the column padding).
- A grid list (media) follows the same rules. A tile grid is `.mt-tiles` (12px padding at the left and right), and the tool row above is `.mt-table-head`. So the first letters of the posts table and the media grid are on the same vertical line.
- A table list is wrapped in `.mt-table`. The rows get 12px padding at the left and right, so the picked row's background does not touch the first column's text. The rows above and below the table (the search-place row, the column-name row, the bulk bar, group names, pagination) follow the same 12px inside (`.mt-chips`, `.mt-list-head` and `.mt-bulk` do it by themselves; other rows use `.mt-table-head`). The rules go all the way to the end.
- When rows are picked, the bulk bar (`.mt-bulk`) replaces the column-name row. See "Bulk bar".
- A picked row (`.mt-row.is-on`) is painted only inside the rectangle of the table: no rounded corners and no margin going out of the table. The background is `bg-selected` and the rule under it is `border-default`, so the lines do not merge into one when picked rows are next to each other.
- A row under the pointer (`.mt-row:hover`; `.is-hover` in the drawings) is `bg-muted`, one step paler than a picked row, so the two are not confused. When a menu is opened by right-clicking a row (a folder row too), that row stays `bg-muted` while the menu is open, so you can see which row the menu is for. A menu opened from ⋯ does the same.

### In code

`Table` (with `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`) draws a fixed-layout table. Options: `columns` widths in px, a total width, `scroll` (the table scrolls sideways in its own box) or `none` (the page or a parent scrolls it, needed for a sticky header and for the row check that hangs in the left margin), `layout="fixed"` for resizable columns, a sticky header, and a quieter "stale" state while new rows load. Row parts: `RowCheck`, `RowLink`, `RowTitle` (the title in ink over its address in mono, one line each; the other columns are gray), `RowActions`, `ListScroll`. `ListHead` draws the column-name row: each column has a `ListHeadColumn` with `width` in px (without it the column takes the room the others leave), `sorted` (name in ink with ↓ or ↑), `filtered` (a dot follows the name) and `menu` (the rows of a menu: sort, values to filter by, hide). `ListHeadAdd` gives the columns that are off, offered by the + at the end, and the + button's name ("Add column"). The menu card is 220px, with row text starting on the name's line (the card reaches 15px past the name's side). A drag starts after a small pointer movement and only while the button is held, so a press stays a click and a press that opened a menu never becomes a drag. A dragged name takes a neighbour's place when its middle reaches the neighbour's middle, so two columns never trade back and forth.

`List` and `ListItem` in `@monti-cms/ui` are a different part: a list of short lines (`bullet` marks each with a dot; `none` is a plain column), for what a step will do or what a folder holds.

## Select all

A checkbox in the left outer margin at -26px, on the same vertical line as the row checkboxes, in the column-name row and in the bulk bar. When nothing is picked it is hidden, and it shows when the pointer is over the column-name row. While rows are being picked (the bulk bar) it is always shown. If only some are picked it is `.mt-check.is-mixed` (a bar through the middle). If all on this page are picked it is `.is-on`. Pressing it picks only the current side (page).

### In code

`ListHead` and `BulkBar` take a `selectAll` prop of type `SelectAll` (`state` is `none`, `some` or `all`), exported with `SelectAllState` from `@monti-cms/ui`.

## Bulk bar (`.mt-bulk`)

While rows are picked, it takes the place of the column-name row: the same place, the same 40px and the same bottom line (`border-muted`), so the rows below do not move. The select-all check is in the same left outer position as the row checks. When everything picked is released, the column names come back.

`☑ N개 선택 │ ✦ 요청 │ 발행 · 보관 · 폴더로 ▾ · 바꾸기 ▾ │ ⋯` … and at the end `선택 해제`. (N selected │ ✦ request │ publish · archive · to folder ▾ · change ▾ │ ⋯ … deselect.)

- The bar holds only things that every collection has, so it is the same bar in every collection. What comes from the schema (relation fields) is all inside one "바꾸기 ▾" menu. There is no button per field (that would make the bar differ per collection, and there is no rule for which field gets a button).
- **발행** (publish): shown only if some picked row can be published (draft, editing). If all are already published it is hidden. A text button, no menu.
- **보관** (archive): a text button. If all picked rows are archived it is "보관 풀기" (unarchive; unarchiving returns the entry to draft). There is no separate action to withdraw a publish: archiving ends being public.
- **폴더로 ▾** (to folder): the top level and the folder tree. Picking moves and closes.
- **바꾸기 ▾** (change; `.mt-dropdown`, 200px): the first level is the relation fields that can be changed in this collection, in schema order ("카테고리" (category) › · "태그" (tag) ›). Hidden columns appear too. Back-references (`backlink`: what is stored on the other side, like a collection) and fields inside a conditional branch (the replacement entry that exists only when deprecated) are not there. Select fields are not there yet (there is no bulk change for them in core).
  - A relation with several values (tag): a search row at the top, then for each value a three-state check row. ☑ all picked rows have it, – only some have it (`.mt-check.is-mixed`, a dimmed `n/N` at the right), ☐ none has it. Pressing adds it to all picked rows, or removes it from all if it was ☑. The menu stays open, so several can be changed at once.
  - A relation with one value (category): a pick-one list. If all picked rows have the same value, that row has a ✓. If the field is not required, "없음" (none) is at the top. Picking changes at once and closes.
- **⋯**: "내보내기" (export), a rule, "휴지통으로" (to trash, red).
- A collection of items (an `item` collection like tags) has no archive or publish. The bar holds only what that collection does. The tag list is `N개 선택 │ 합치기 · 휴지통으로` (N selected │ merge · to trash).
- Trash is `N개 선택 │ 복원 · 영구 삭제` (N selected │ restore · delete forever; the last is red).
- Right-clicking one of the picked rows gives the same things with the same names (see Menu, row menu). A right-click menu uses at most a second level, so the relation fields stand in the menu directly, without the "바꾸기" level.

### In code

`BulkBar` replaces the list's head row in the same place, the same 40px with the same line under it. It takes `label` ("3 selected"), `request` (an assistant request: a spark and its label), the most used actions as `children` (text buttons and menu buttons), `more` (a ⋯ with the rest, the dangerous one last, in red), and at the end `clearLabel` and `onClear` (the button that clears the pick). `colSpan` is how many columns the table has, the ⋯ column included. It is a row of the list's table, so it spans the table's `colSpan` columns; the table keeps its widths from its columns, not from this row.

## Grid cell

Cells of the media grid, and folder cells. A folder is a low cell, and a file is a 4:3 preview. A file being uploaded is a faded preview with a progress bar.

## File tile (`.mt-tile`)

One cell of the media grid. A 4:3 preview, with the file name (14) under it and the info (mono 12).

- Uploading: the preview is faded and a `.mt-progress` runs along the bottom edge; the info line reads "올리는 중 · 64%" (uploading · 64%).
- Failed (`.is-failed`): the preview border and the info line are red, and the name is faded. Under it `.acts` holds what can be done ("줄여서 다시" (shrink and retry), "빼기" (remove)). A failed file does not disappear; it stays in its place.
- Picked: a check box at the top left, and a 2px ink border.
- ✦ suggestion (for several files at once): the suggested sentence goes into the info line as `.mt-ins` (pale blue ground, body font), the same as the editor's suggestion mark. The line above reads "✦ 제안 3 … 모두 버리기 · [모두 받기]" (✦ 3 suggestions … discard all · [accept all]). Pressing the suggestion mark opens a note card (`.mt-memo`) with a blue border; the head row's "버리기 · [받기]" (discard · [accept]) handles only that file, or "이어서 요청" (continue the request) edits again on the spot.
- Files (PDF · ZIP · TXT · MD · CSV · JSON) show `.img.is-file` instead of a preview: a 20px file icon in the middle and the extension (mono 11, "PDF"). Uploading and failed are the same as for images (progress bar below, red border and info line). A format that is not accepted stays there, and its info line says the accepted kinds briefly ("이미지 · PDF · ZIP · 텍스트만" (images, PDF, ZIP and text only)); the one thing to do is "빼기".

### In code

`Tile` is a file in a grid, flat (no card, no border). It has `status` (`uploading` with `progress` 0 to 100, or `failed` with `actions`), a mono detail line under the name (size, usage, a path), `picking` (the check shows faintly on every tile while any is picked), `action` (the ⋯ at the top right, shown with the pointer) and `proposal` (the assistant's suggestion in place of the detail line; a picked tile that has one is ringed and checked in blue). A failed tile has a 1px red ring drawn over the preview's edge. `FilePreview` is what a tile shows for a file: the 20px file icon and the extension (use it as the tile's `preview`; it goes fainter when the tile failed). `FolderTile` is the low folder cell (it takes `dropTarget`). `Grid` with `columns="tiles"` is the tile grid (`.mt-tiles`): columns of at least 180px, 24px between rows and 20px between columns.

## Media picker (`ImageInsert` board)

The library as a panel for choosing: images to insert from "/ 이미지", the cover image field, and files from "/ 파일". A 760px modal: the folder list at the left (168px; "모든 이미지" or "모든 파일" first, sub folders indented, the chosen one on `bg-current`; the count in mono), then the search box and three columns of tiles. At the bottom left "올리기" (upload) is a text button with an upload icon; at the bottom right "취소" and one pill ("넣기" in the body, "고르기" for a field). Choosing a tile and pressing the pill puts it in at once: there is no alt text or caption step and no tabs. "올리기" chooses a file and hands it to the page as a paste does. The folder count shows only for images: it counts every kind of file.

### In code

`MediaPicker` is the whole panel: `folders` (each with `depth` and an optional `count`), `folder` (`null` for all), the search, `onUpload`, `confirmLabel` and the tiles as `children` (a `Tile` each, `FilePreview` for files). The tile area scrolls inside the panel.

## Drop target (`.mt-droparea`, `.mt-folder.is-drop`, `.mt-toast--drop`)

When files are dragged in, nothing is hidden: only where to drop is shown (the same way as Google Drive and Dropbox).

- Dropping in the current folder: `.mt-droparea` wraps the folder tiles and the file grid and gets `.is-over`. A 1.5px solid ink line is drawn 12px outside the grid, and a 7% ink film covers the whole area by multiply (`mix-blend-mode: multiply`; `screen` in dark). Painting only the background would blend with the folder tile (`--bg-muted`), but multiply darkens the ground, the tile and the preview by the same ratio, so the usual differences remain. The tile colors do not change. A dotted line or a faded film that hides content is not used.
- Over a subfolder: the area's border goes off and only that folder tile gets `.is-drop` (the selected ground + a 1.5px ink border).
- A pill at the bottom center, `.mt-toast.mt-toast--drop`: an upload icon and "여기에 올려요" (upload here) / "**covers**에 올려요" (upload to covers). The current folder's name is already in the title, so it is not written; the folder name is shown in bold only when the place to drop changes.
- Quiet work such as shrinking to WebP or removing location data is not written.

### In code

`DropArea` wraps what files can be dropped on. `over` means files are dragged over the area and not over a folder in it. A folder the files are over takes `FolderTile dropTarget`, and the area's frame goes out. The hint is `toast.dropHint`.

## Empty state

An empty state. Instead of an explanation, it lists what can be done, in order ("01 · 02 · 03" only when there really is an order).

- The name of each thing to pick is `text-title` (16 / 600). Unlike a table row title (14 / 400), these are items to pick, so they look like subheadings.

### In code

`Empty` shows a line that says there is nothing and, instead of an explanation, the things that can be done as `EmptyStep`s in order. It has no box. An optional quiet line goes under the title, only when the steps cannot say what is missing. A popup or a short list that is empty needs no component: one quiet line of text. `EmptyStep` is the title at the size of a choice, an arrow at the end and a rule under it. Its `number` ("01") is for an order that really matters. It is a button, or a link with `href` or the router's link in `render`.

## Field outline (`.mt-tree`, `.mt-ftabs`)

The field list of a collection. The tabs of the properties panel work as real tabs (see Craft's field layout designer). Only the fields of one tab are shown at a time.

- The tab row `.mt-ftabs`: folder tabs sitting on a box. The picked tab has the same ground as the box and is open at the bottom, so it joins the box. The other tabs are closed in `bg-muted`. Each tab has a grip, a name and the field count; a tab placed by a plugin has a lock. At the end is a `+` (add a tab).
- The box `.mt-ftabs-body`: the field rows of the picked tab. Only its top left corner is square, to join the picked tab.
- To move a field to another tab, drag the row onto the tab's head.
- A group `.is-group`: a `bg-muted` band inside the box, with the name at 13 bold. Fields in a group are indented 16px (`.d2`).
- With only one tab there is no tab row and no box, only the rows, and `+ 탭 추가` (+ add a tab) below.
- It does not look like the underlined tabs at the top of a screen. Layers are not made by font size or a single line.

### In code

`FolderTabs` (with `FolderTabsList`, `FolderTab`, `FolderTabsAdd`, `FolderTabsBody`): `FolderTab` has a grip to drag it by (off for a tab that stays where it is), its name, how many fields it holds, and `locked` for a tab a plugin placed, which cannot be moved or removed. `FolderTabsAdd` is a 16px plus icon named by its `aria-label`. The body is a `FieldTree` without its outer rules; its top left corner is square. `FieldTree` is the outline of a collection's fields: one line per field (`FieldRow`), each with a grip, the name (mono), the label and, at the end, the kind (mono; it can carry a mark such as a required "!"). `nested` indents a field in a group or a branch. `group` makes the line a group's: a grey band with its name in sans, bold. A field that cannot be moved has no `grip`; its place stays empty so the names line up. `changed` is an unsaved change.

## Applied filters

When a filter is applied, the dropdown in that place (`.mt-filter`) becomes a `.mt-chip` ("대체 텍스트 없음 ×" (no alt text)). The info beside the page title does not use the filter's name, only the count. Filters and search look in the current folder and its subfolders (the count in the menu is the same range). When applied, after the chip comes a rule and a toggle for where to look (`.mt-seg--sm`) "Blog Assets | 모든 폴더" (this folder | all folders), to widen it (the same as macOS Finder's search scope). A file in a subfolder or another folder gets its path before the info line. Making a folder is in the head's "+ 폴더" (+ folder; a text button, the same as the posts list) and the right-click menu on empty space, not in a grid tile.

## New folder and rename (`.mt-rename`)

Pressing "+ 폴더" makes a new folder on the spot with no dialog, and the name field `.mt-rename` opens with "새 폴더" (new folder) selected. Typing changes the name and Enter finishes. In the posts list the new folder is at the top folder row; in media it is at the end of the folder tile row. Rename uses the same field. The field (28px) overlaps the title row (20px) by 4px above and below, so while renaming, the row height and the rows below do not move.

### In code

`RenameField`: the name of a new folder, or of one being renamed, edited where it stands. It opens with the whole name selected, so typing replaces it. Enter and leaving the field keep the name (`onCommit`, called once); Escape drops the change (`onCancel`). In a folder tile it fills the tile (`fill`); in a row it sits 200px wide with its text on the line of the other names.

## Inside a folder (posts and media)

- Above is the path ("게시글 /" (posts /), "미디어 /" (media /)), the title is the folder name, and the first row is "상위 폴더로" (up one folder).
- Search and filters look in the current folder and its subfolders. When applied, the search-place row shows the toggle for where to look, "folder name | 모든 폴더". At the top level it is already everything, so there is no toggle.
- Deleting a folder moves the folder and what is in it to the trash as one lump. It asks for confirmation only if a published post is inside; otherwise it shows a toast with "되돌리기" (undo).

## Pagination (`.mt-pager`, `.mt-page`)

- A page number is a 32px-high button. It is never narrower than its height: one digit is a circle, two or more a pill.
- Text is 14px `fg-muted`. The current page is `.is-on`: `bg-selected`, ink, semibold (600). The pointer over it gives the same ground.
- Both ends are "‹ 이전" (previous) and "다음 ›" (next) (`.mt-page--wide` + `--prev` / `--next`). The previous of the first page and the next of the last page are `.is-off`: dimmed and cannot be pressed.
- Up to 7 pages, every page is shown. With more, it is always 7 buttons: `1 … current-1 current current+1 … last`; near the start `1 2 3 4 5 … last`; near the end `1 … last-4 … last`. The width of the pagination does not change as pages turn.
- It is at the right end of the row under the table (`.mt-table-head`). At the left is a range like "1–25 / 148" and, beside it, the per-page `25개씩 ▾` (`.mt-per-page`).

### In code

`Pagination` (with `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`) is the pager at the right end of the row under the table. The first page's previous and the last page's next are dimmed to .45, not followed and not reached with the keyboard. `ListFooter` is the row under a table: the shown range ("1–25 / 148", a `Count`) at the left, the pagination at the right, 12px inside like the rows and 12px under them. `PageSizeMenu` is the "25 per page ▾" in mono beside the range; its menu opens upward, and picking a size applies it and closes the menu.

## Folders in the trash

- A deleted folder shows as one row (a folder icon, "게시글 폴더 · 글 2" (posts folder · 2 posts)). The date it was thrown away and the days left are for the folder as a whole.
- Pressing it opens it inside the trash. The path is "휴지통 /" (trash /), the title is the folder name, the first row is "상위 폴더로", and the head has "폴더 복원 · 영구 삭제" (restore folder · delete forever). The date column of the rows inside is empty.
- Restoring one thing inside makes the folder again and puts it back in its original place. What remains stays in the trash folder.
- Trash search also finds what is inside folders, and puts "시리즈 원고 폴더 안" (inside the series drafts folder) before the info line.

## Merging categories

In the tag list, picking two puts "합치기" (merge) in the bulk bar, in the place of the column-name row (name · post count). A dialog picks the name to keep with a radio, and shows the number of posts that change and the addresses that disappear in one line. After merging, a toast reads "글 3편의 태그를 리액트로 바꿨어요 · 되돌리기" (changed the tag of 3 posts to React · undo), and the merged tag goes to the trash.

## Language list

The list of content languages in Settings › Languages. The language name is the lead (`.mt-row-title`), and the code and display name follow dimmed (`English en · 영어`; if the display name is the same as the name it is left out). The name comes from the language code and is not edited. A row has no input and no edit row.

- **Source row**: fixed at the top. The place of the handle is left empty, and at the left it carries only the language info, like the other rows. At the right end (where the other rows have ×) are a bold "원문" (source; `text-note`, `fg-default`, 600), a vertical rule (`.mt-vr`), and an underlined text button "바꾸기" (change). The state and the button that changes it are in one place and are not mixed with the pale info at the left (code, display name). The right cell has only one quiet underlined text button, "바꾸기" (`.mt-text-btn--underline`). The word "원문" is not written separately.
- **바꾸기**: opens a one-level menu (`.mt-card` + `.mt-menu-item`) with the languages in a line. The current source has a ✓ (`.tick`). Picking another language moves it to the top and makes it the new source (with "원문 | 바꾸기" at its right), the old source gets a handle and ×, change dots appear on the two rows, and the changed places count goes up by 1. It is a structure change, so it is saved after review like other structure changes.
- **Other rows**: only a drag handle and ×. The × is the same quiet × as the × of the other host-name rows. × strikes the row and adds to the changed places. Removing a language that has translations lets you pick "남겨 두기" (keep) or "휴지통으로" (to trash) in the review.
- **Adding a language**: "+ 언어 추가" (+ add a language) opens a code search menu (the last item is "직접 입력" (enter by hand)). Picking a code makes the row at once, with no form; the name is filled in and a change dot appears. Only "직접 입력" opens a small dialog (`.mt-dialog`, 420px) that asks once for the code (letters), the native name and the display name ("취소 · 추가" (cancel · add)).
- On a deployed site without the GitHub plugin the whole section is structure, so the lock goes after the section title (`h2`), and the handle, ×, "바꾸기" and "+ 언어 추가" all go. The bold "원문" at the right of the source row stays as the state, and only the rule and "바꾸기" go. The time zone on the same screen is an admin setting, so it can still be edited.

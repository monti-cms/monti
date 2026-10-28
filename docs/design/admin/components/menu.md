# Menu

This page covers the floating menu card and everything that uses it: the ⋯ menu, the block menu, the "/" insert menu, the template picker, row menus on right click, and the pick list.

## Menu card

The floating menu card. Paper ground, `border-emphasis`, `radius-xl`, `shadow-floating`. Width 240px (`width-menu`); a longer row may widen it.

- Group names are mono 11px. A shortcut goes at the right, in mono.
- A menu holds only what can be done here. What cannot be done is hidden, not dimmed with a reason beside it. A menu left with one item loses its ⋯, and that one thing is done directly on the row. If only "rename" is left, pressing the name renames it in place (`.mt-rename`).
- The `bg-selected` ground (`is-on`) is used only for the row the pointer or keyboard is on and for the row whose second level is open.
- A menu that picks one value marks the current value with a ✓ at the right (`.tick`). Pressing a value applies it at once, and the whole menu closes.
- The exception is the filter values of a column menu. Filters often take several values at once, so the menu stays open after a value is picked (even after the second date of a period). Esc or a press outside closes it. The sort in the same menu closes when picked.
- A row with a › shows the current value, dimmed, after its name (`.val`, "최근 수정" (recently edited)).
- A menu near the bottom of the screen opens upward.
- A row that needs one more value ends with `.sub` › and opens a second level at its side (the block menu's "다른 블록으로 바꾸기" (change to another block) and "정렬" (align); "폴더로" (to folder) on a right-clicked row). These menus are opened with the mouse, which is why this is allowed. The second level opens toward the screen, and its current value is marked with a ✓ or a check. A third level is not used.
- Exception: the editor's "/" menu, opened with the keyboard while writing, uses one level only. It must be usable with the up and down arrows and typing alone.
- No button or toggle group goes inside a menu row. Values to pick go to a second level.
- When the second level has many values (tags), it gets its own search row at the top.
- A check row that changes the value of several rows at once has three states: ☑ (`.mt-check.is-on`) all have it, – (`.mt-check.is-mixed`) some have it, ☐ none has it. For "some", a dimmed `n/N` (`.k`, "1/2") goes at the right. Pressing adds it to all, or removes it from all if it was ☑. The menu stays open.
- A menu opened from a text button (`.mt-dropdown`): the card opens 12px below the button, and the row text starts on the same vertical line as the button text (card 6 + row 9 = -15px on the left). The open button is ink (`.is-open`). When a row of this menu opens a second level, the `.mt-submenu` goes inside that row so that its first row is level with that row, 4px from the card (`.mt-menu-item.has-sub`). The button is the first level, so there is no third level.
- Rows are not dragged to reorder inside a menu. A drag trapped in a floating menu is awkward, and dragging to the end makes the menu scroll. Columns are turned on and off with the column menu's hide and the + above the ⋯, and reordered by dragging the column names of the table (see List).
- A menu with many items (the "/" insert menu) has a search row at the top (`mt-menu-search`), and the list under it shows up to 320px and scrolls inside (`mt-menu-scroll`). Typing filters across groups.
- The "/" menu opens under the typed "/" (over it near the bottom of the screen) and keeps the focus in the body: the search row shows what was typed after the "/", and the arrows, Enter and Esc work from the keyboard. Its groups are "글" (paragraph, headings, lists, quote, divider), "넣기" (image, table, code block, file, link to another post, footnote, what a plugin inserts), "컴포넌트" (the site's blocks) and "템플릿 · 이 자리에 넣어요" (the post templates, name and sections). Typing "템플릿" narrows the list to the templates. A template goes in at the cursor, in the place of the typed "/", as a copy with new block ids; it asks nothing, and a template with a block the body's allowed list does not allow is not listed.

### In code

`DropdownMenu` (with `DropdownMenuContent`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Label`, `Separator`, `Sub`, `SubTrigger`, `SubContent`, `Scroll`, `Search`, `Group`, `Trigger`), `Command` (a menu you can search; its content is a `PopoverContent` with `padding="menu"`; `CommandItem` has `checked` for the current value of a pick-one list, and `variant="danger"`), `MenuShortcut`, `MenuTick`, `MenuValue`. A row has an icon first, a name, and a `MenuShortcut` at the end. `variant="danger"` is for what cannot be undone, and goes at the bottom. In code a row that cannot be used is faint and can say why in its `MenuShortcut`, which the DS rule (hide what cannot be done) does not describe.

Row menus use `ContextMenu` (see below). The card look is the shared `MENU_CARD`. The code opens the second level 4px clear of the parent card (`SUB_SIDE_OFFSET` and `SUB_ALIGN_OFFSET`).

## Row menu (right click)

Right-clicking a list row or tile opens it at the cursor (`.mt-menu--ctx`, 232px). The same items are also in the ⋯ at the end of the row.

- Each row has a 16px icon at the left (`.ico`), and a shortcut (`.k`) or a ▸ (`.sub`) at the right. The DS README says the icons are "the same lucide as the code". The code now uses Carbon icons (see the Tokens page, Icon size).
- What cannot be undone, or takes something down, is last and red (`.is-danger`).
- If several rows are picked and one of them is right-clicked, the menu starts with "2개 항목" (2 items), and it holds the same things as the bulk bar, with the same names: "발행" (publish) · "보관" (archive) · "폴더로" (to folder) ▸ | "카테고리" (category) ▸ · "태그" (tag) ▸ | "내보내기" (export) | "휴지통으로" (to trash) Del. Things that work on one row only (open, duplicate) are left out. There is no "change" level (it would make a third level). There are no icons either.
- Posts: "열기" (open) · "새 탭에서 열기" (open in a new tab) · "복제" (duplicate) | "폴더로" ▸ · "카테고리" ▸ · "태그" ▸ | "보관" · "휴지통으로" Del
- Media: "열기" · "쓰는 곳" (where used) ▸ · "폴더로" ▸ | "휴지통으로"
- Trash: "복원" (restore) | "영구 삭제" (delete forever) Del

### In code

`ContextMenu` (with `Content`, `Item`, `Group`, `Label`, `Separator`, `Sub`, `SubTrigger`, `SubContent`, `Trigger`). A row that picks a further value is a `ContextMenuSubTrigger` (→ opens the second level, ← closes it).

## Pick list (`.mt-picklist`)

A list of menu rows placed directly on a screen or in a sheet, without the menu card. Use it where one is picked to go on to the next step, such as the kind of a new field. A row is the same as `.mt-menu-item` (icon 16 · name · a gray note or → at the right), with no card border and no shadow. A group name is `.mt-menu-label`.

### In code

`PickList` (a listbox) with `PickListItem` rows, its options (a `mark` at the end when picking opens more). The picked row takes the selected background and ink; the others are muted. Name it with `aria-label`.

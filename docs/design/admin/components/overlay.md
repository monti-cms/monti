# Overlay

This page covers the three surfaces opened over a screen (modal, sheet, side panel), how to choose between them, and the tooltip.

Choose by what the surface is for.

| | When | Examples |
|---|---|---|
| Modal | Asking: a decision in a few seconds | "공개 중인 글을 휴지통으로" (move a published entry to the trash), "영구 삭제" (delete forever) |
| Sheet | Making: several inputs | "필드 추가" (add a field), "저장 검토" (review a save) |
| Side panel | Looking at together: next to the screen, not covering it | "미디어 파일" (media file), "활동 자세히" (activity details) |

Properties and the assistant are side panels too.

## Modal

A modal is for asking only: a decision that ends in a few seconds, where nothing else may be done before answering ("휴지통으로 옮길까요?" (move to the trash?), "저장하지 않은 변경" (unsaved changes)).

- A rule in ink under the title. The body is the result only, short.
- When the title alone does not say what the window is about (changing the value of one key), the name follows the title, dimmed, in `.of`: "값 바꾸기 · Anthropic 개인" (change value · Anthropic personal). Same line, normal weight, `fg-subtle`.
- Bottom right: a text button ("취소" (cancel)) and one pill. For a dangerous decision the pill is danger.
- When there are several inputs or it gets long, use a sheet.
- Surface: the page ground with an emphasis edge, `radius-xl`, `shadow-overlay`, 28px around (22px below), 420px wide. The title is 20px (`text-heading` role) and the actions are 18px apart. Behind it goes `bg-backdrop` alone, with no blur.

### When a delete shows a modal

Decide by whether it can be undone, not by what kind of thing it is. There is no "do not show again" check.

- Moving to the trash (a draft, a memo, an item, media, a folder): no modal. Move at once and show a toast with "되돌리기" (undo). If something that is used elsewhere was left in place, the toast also has "보기" (view).
- Confirm only when the site is affected at once: a published entry (it stops being public and its translations go with it; restoring brings it back as a draft).
- What cannot be undone (delete forever, empty all, delete a collection): confirm every time.

### In code

`Dialog` (`DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger`; `DialogPortal` and `DialogOverlay` are the portal and the dimmed ground that `DialogContent` already draws, so a screen does not use them) and `AlertDialog` (a question that must be answered before anything else; closed only by its own buttons or Escape) with `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel` and `AlertDialogAction` (`AlertDialogPortal` and `AlertDialogOverlay` are the same pair as in `Dialog`). `AlertDialogContent` has a `wide` size (520px) for a question that lists what it touches, with a choice per line (the review of a permanent delete). `DialogFormFooter` is the footer of a dialog that holds a form: a cancel text button and one pill, which shows its `busyLabel` while the request runs. Focus lands on the first text field when a modal opens, else on the modal itself, so no button shows a focus ring at the moment it appears.

## Sheet

A sheet is for making: work with several inputs that may get long (add a field, review a save). It opens from the right and dims what is behind.

- Width `width-sheet` (520px), cream ground (`bg-tool`), a head of 60px (title and ×), and at the bottom a cancel and one pill.
- While it is open it also covers the ✦ button.
- To work with the screen behind in sight, use a side panel.

### In code

`Sheet` (`SheetContent`, `SheetHeader`, `SheetBody`, `SheetFooter`, `SheetTitle`, `SheetClose`, `SheetTrigger`). It opens over a dimmed page with a line down its left edge, square, with `shadow-sheet`. Its width is fixed. `SheetHeader` has no ✦ place; with `closable={false}` (the sheet is busy and cannot be left) there is no close button. The body scrolls when longer than the sheet. The title can end in what the sheet is about with `SheetTitle of` ("필드 추가 · 노트").

`SheetSection` is a titled part of the body ("보기", then "구조"): the title in 14px semibold, the fields under it, a later section 8px lower; the title can end in a `LockMark`. `SheetSplit` splits the body in two: a list on the left (150px, a rule on its right edge) and the work on the right under its own tabs. "필드 추가" uses it: the kinds are a `PickList` (a listbox) and the settings of the picked kind sit beside it under the tabs "기본" and "고급".

## Side panel

A side panel is for looking at together: next to the screen without covering it (category item, media file, activity details, properties, assistant).

- Cream ground, a thin inset line on the left, a head of 60px. It closes with the × at the end of the head (12px from the right edge). The assistant is the same.
- It is docked at the window's right edge and covers the ✦ button. ✦ opens the assistant, so while a panel is open it lies under it and is not seen. So the right of the head is not kept empty for ✦.
- The properties pane is the exception: it has no head and no ×. It opens and closes with the properties button of the page header, and its tab bar is its top row.
- Fields inside a panel: the label is `mt-label` (mono 11) and the value is `text-note` (13). A panel is a tool, so its text is one step smaller than body text (14).
- When there is something to save, one pill goes at the bottom.

### In code

`PropertyPanel` is the entry's properties pane: a `SidePanel` 300px wide with a tab bar (`TabsList variant="bar"`) in place of the head, no title and no close button, and a read list under it. `PropertyGroup` is a run of rows with an optional quiet subheading ("분류"); `PropertyRow` is one property: the label above (mono 11) with an `action` at the right end of the label row, the value below (13). At rest the value is text with no box, and pressing it opens the field in place (`onEdit`, `editing`); an empty value reads `fg-faint` (`empty`); a value the assistant wrote is `fg-proposal` and described as the assistant's (`proposal`). The fill `action` shows only while the pointer or the keyboard is in the row, and while it works.

`SidePanel`: `title` is optional (without it there is no head; give `aria-label`, and `bar` for a pinned tab row), `width` is `side` (360px; a file or an activity beside a list), `panel` (300px; an entry's properties) or `assistant` (380px). The title is 16px bold. It takes optional panel icon buttons and the close button in the head, and a foot that holds the one pill or the box to type in. The panel is named by its title. Put it in a row beside the screen; on a narrow screen it takes the whole width. With `onSubmit` the body and foot are one form. The look shared with the sheet is the `PANEL_*` strings (a 60px head, a body with 20px above and 24 at the sides).

## Name and value

A name and value pair. The information in a panel (type, size, upload date), activity details, delivery information.

### In code

`DescriptionList` with `DescriptionItem`: the label column is 76px wide so the values line up; long values wrap. Labels are quiet and values a step darker, both at the regular weight.

## Popover

A floating card for a small form or a note, or the card around a menu. The DS README lists popovers under Overlay but gives them no rule of their own; this section comes from the code.

### In code

`Popover` (`PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription`, `PopoverTrigger`). `width` is `sm` (240px, a menu's width), `md` (300px, the default, a panel), `lg` (380px, the assistant), `auto` or `anchor`; `padding` is `menu` (6px, for a list of rows), `default` (a small form or a note) or `none` (the content brings its own rows, such as a calendar). It scrolls inside when taller than the space left.

## Tooltip (`.mt-tooltip`)

A small black pill that names an icon button that has no text. 12px, and a shortcut in mono 11, dimmed, at the right when there is one. It shows on pointer hover or when the keyboard moves to the button. No sentence goes in it: one or two words, the name only. A text button gets no tooltip.

### In code

`Tooltip` (`TooltipTrigger`, `TooltipContent`, `TooltipProvider`); `shortcut` takes the keys (`["mod", "S"]`), written "⌘S" on a Mac and "Ctrl+S" elsewhere (see Menu, "Shortcuts").

## Toast

The toast (a short result at the bottom center) is described in the Status page.

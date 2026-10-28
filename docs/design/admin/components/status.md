# Status

This page covers what tells the present state: entry status, counts, change dots, progress, notice strips and toasts.

Color is for state only, and it is always paired with a shape or a word.

## Entry status

The state of an entry, given by a dot shape and a word together. Color alone never tells states apart.

- "발행됨" (published): a filled dot, `fg-success`.
- "수정 중" (editing: published, with changes not published yet): a filled dot, `fg-warning`.
- "초안" (draft): an empty ring, `fg-muted`.
- "보관됨" (archived): a short bar, `fg-subtle`.
- "실패" (failed): `fg-danger`.
- In a list's status column, "발행됨" is the ordinary case, so it is written in the quiet color (`.mt-status--quiet`, `fg-subtle`).

### In code

`EntryStatus` with the kinds `published`, `editing`, `draft`, `archived` and `failed`. It draws a 7px mark and the status name. Without children it is the mark alone (a language tab's status); that is decorative, so the status must be said in words nearby. The editing dot is drawn in the warning mark color (`bg-warning-emphasis`) while its name stays in the warning text color. It has no version for a dark pill. `quiet` gives the subtle tone and normal weight for a column of statuses.

## Count

A number goes next to a name, in mono. When there is something to deal with, it takes the warning or danger color. A number is not put in a pill.

### In code

`Count`. `tone` is `default`, `warning` or `danger`.

## Change dot

A dot for something unsaved or suggested: an orange dot of 6px (`mt-change-dot`) for an unsaved change, a blue dot (`mt-proposal-dot`) for an AI proposal.

- It sits right after the name, 6px away, centered on the text height. Tabs, field labels and sidebar items are all the same.
- A badge floated at the top right corner is not used. A dot beside the text reads together with the name.

### In code

`ChangeDot`: `tone` is `warning` (the default, `bg-warning-emphasis`) or `proposal`. `label` names it for screen readers; without it the dot is decorative. The meaning must also be in words nearby or in `label`.

## Progress

A 3px progress bar. It goes under the box of a file being uploaded. Usage of AI tokens is written as text only, with no bar. A stretch that cannot be measured ("준비 중" (getting ready), "마무리 중" (finishing up)) shows words instead of a bar.

### In code

`Progress`: `value` is 0 to 100. It is a 3px bar with radius 2 on a `border-default` track, filled with ink.

## Notice strip

A one-line notice attached to the top of a view ("원문이 바뀌었어요" (the source changed)). Cream background, one rule below. At the right end go the actions that can be done right away.

Where a notice goes depends on what it is about.

- A state that concerns a whole entry (source changed, edit conflict, unsaved entry): directly under the bar above the editor, from edge to edge (`.mt-banner`, no margin).
- A notice about a list inside a page (a delivery failed N times, "모두 다시 보내기" (send all again); a key that cannot be read): directly above that list, inside the column, at the column width (`margin-top: 24px`). The notice's action works on that list, so it sits by the list.

A notice that runs across the top of a page screen is not used. It overlaps the ✦ button at the top right, and it does not line up with the columns and rules. A screen that cannot be edited shows a lock beside each value instead of a notice (see Field, read only).

### In code

`Banner`: a 6px dot leads the sentence, 8px before its words. `tone` is `warning` (the default) or `danger`. `title` is the sentence and `meta` the small mono detail after it, cut with "…" when the line is short (`plainMeta` sets it as a plain subtle sentence instead, as on the edit conflict strip: "이 글은 저장할 수 없어요"); `children` are the actions at the right end (text buttons: the one that goes somewhere underlined, then the one that dismisses).

A failed notice (a failed delivery, an edit conflict) is danger, not warning, and uses red (`.mt-banner--danger`).

The editor has two strips: the edit conflict ("다른 곳에서 10:41에 먼저 저장했어요" · "이 글은 저장할 수 없어요" · 비교하기, 서버 최신본 불러오기) and the draft kept only in the browser ("이 브라우저에 저장하지 않은 편집이 있어요" · 10. 26 10:12 · 비교하기, 불러오기, 버리기). Neither is a dialog and neither goes away until it is answered.

## Toast

A one-line result right after an action ("발행되었어요" (published), "발행할 수 없어요" (cannot publish)). It appears at the bottom center on an ink ground. If there is a next step, one text button goes on the right ("이동" (go), "보기" (view) after a publish: it opens the public page). It disappears after a few seconds, so anything the person must see stays in a status line or a to-do.

- A failure or an error ("저장 실패" (save failed), "발행할 수 없어요") is on a red ground (`.mt-toast--error`, `bg-danger-emphasis`). The text and the button are the same light color.
- The hint shown while files are dragged over a folder is a toast too. See the List page, drop target.

### In code

`toast` and `Toaster`. Every toast is one message with at most one action (`action`, which runs `onClick` and closes the toast); `duration` is in milliseconds (the `Toaster` default is four seconds; `Infinity` keeps it until `toast.dismiss`), and a toast shown with the id of an open one replaces it (an upload counting up, then done). `toast.error` is the red one. `toast.dropHint` is the drag hint, with the folder's name in bold; it stays until `toast.dismiss(id)`. The `Toaster` has its own id, so a site's own sonner toaster never shows the admin's toasts and the other way around.

## Warning text and warning mark

Warning has two colors. Text is `fg-warning` (`#9a6200`, dark enough to read). Dots, rings and marks are `bg-warning-emphasis` (`#aa7406`, one step lighter). They are the same amber family, so they read as one color side by side. A notice that something failed (a failed delivery) is danger, not warning, and uses red.

The DS README lists the code names as `StatusIndicator · Badge(count) · Progress · Alert(strip)`. In code they are `EntryStatus`, `Count`, `Progress` and `Banner`, with `ChangeDot`, `toast` and `Toaster` as well.

# Change review

This page covers the review sheet that opens before a schema change is saved: the change blocks, the split review, deleting a collection, file changes shown as a patch, and the display of changed collections in the list.

When the schema is changed, a review sheet opens before saving. Each change gets one block (`.mt-change`), and what to do with the saved data is chosen there.

## Change block (`.mt-change`)

- In a 48px column at the left is a tag (mono 11). Its color follows the kind: `--new` green, `--edit` yellow, `--drop` red.
- The first line of the right column: the name (bold) and, at the far right, the identifier (mono 12). Everything under it starts on the same left line as the name.
- Choices use `mt-option` + `mt-radio` (pick one) or `mt-check` (on / off). The text is 13px, one step under the bold 14px name. Switches are not used. A black switch at the right end reads with the same weight as the name line. A count is `.n` (mono 12).
- The result in one line is `.note`. If it cannot be undone, `.note.is-danger`.
- A change that adds text shows the line itself with no explanation (`.note.is-add`): a green `+` in front and the text in ink. A name like "더한 줄" (added line) is not added. When a file change (`.mt-patch`) shows the same content, before / after lines are not repeated.
- The list of what is affected is `.lines`: `.what` at the left and `.then` at the right. What is deleted is `.then.is-danger`, and what blocks is `.then.is-warn` (put the button that can clear it in that place).
- If any choice deletes values, the pill at the bottom of the sheet becomes a red "지우고 적용" (delete and apply).
- The sheet's foot holds only "취소" and the one pill ("적용"). It carries no note about the file.
- A choice that needs one more answer carries it at the end of its row: the select of "다른 필드로 옮기기" (which field) and of "빈 글 148편 채우기" (which value).
- A change that no stored value follows from (a new collection, a field no entry holds) has no choices, only the line "저장된 데이터는 바뀌지 않아요.".
- A public address change shows its before and after as `.lines` (전 / 후, mono) and, when published entries change address, the line "발행된 글 | 148편 주소 바뀜" with the note "옛 주소는 404가 돼요." There is no redirect to pick.
- A removed language that has translations is a block tagged "뺌": "남겨 두기" (the default) or "휴지통으로", with the note "다시 추가하면 돌아와요.".
- When the file changed since the screen opened, the top of the sheet shows the error reply (`.mt-msg-error`: "파일이 바뀌었어요", "다시 불러오기") and the pill is off.

### In code

`ChangeGroup` is the `.mt-change` block: `kind` is `new`, `edit` or `drop` (the tag color), `tag` is the app's word ("New", "Edit", "Removed"), `title`, and `identifier` (the key as written in the schema, "summary → excerpt"); the children are what to do with the data already saved. Choices are `Option` rows with a radio or a check. `ChangeLabel` names a part of a change ("what goes", "keep a copy") over the `ChangeLines` it labels, in small mono in the subtle ink. `ChangeNote` is the one-line result (`danger` when it cannot be undone). `ChangeLines` holds `ChangeLine`s (`what`, `then`, `tone` of `default`, `danger` or `warning`). `ChangeActions` is the buttons a change ends with, in one row.

The name `ChangeGroup` in code is the single change block, not the DS's `.mt-change-group` below. The `.note.is-add` line has no counterpart in `ChangeNote`. The DS README names this family `SchemaReview · ChangeGroup · Patch`; no `SchemaReview` exists in `@monti-cms/ui`, and the admin draws the review in `packages/admin/src/screens/schema/review-dialog.tsx`.

## Split review (`.mt-change-group`)

On a deployed site, if a setting that is saved straight to the database (how entries are written) and a file setting are changed together, the blocks of the sheet are split by where they go: "바로 저장" (save now) and "PR". The head is one word (not a sentence), 13px bold, with a count at the right (mono 12) and an ink rule under it. A file change (`.mt-patch`) comes only under "PR". If only one side is changed, there is no split (if only how entries are written is changed, there is no sheet and the button is "저장" (save)).

Not in `@monti-cms/ui` yet.

## Deleting a collection

Deleting a collection permanently deletes its entries too. It does not go through the trash.

- The block has two labeled parts. "지워지는 것" (what goes): the entries (the trash included), the folders and old addresses, the entries of other collections that point to it ("연결 끊김", links cut), and the links in the body (shown as broken links). "받아 두기" (keep a copy): the export of the collection.
- Nothing has to be resolved first. The apply cuts the links that point to it: the pointing entries stay, and only the target leaves their relation field (from the published copy too; it remains in the activity log).
- "지우고 적용" is on from the start: the review itself is the last check, and there is no identifier to type.
- A development database deletes at once; a production site deletes when deployed.

### In code

`DangerBlock` is the step at the bottom of a settings tab that deletes something with its data: a rule in the danger ink above and the `title` in the danger ink, with 24px above and below and 16px between the title and its rows. Each row is a `DangerRow`: its `name`, a quiet `meta` line of what it holds after it ("23 posts · 2 in the trash"; left out when not known), and the `action` button at the end. The review of a deletion is not in `@monti-cms/ui` yet.

## File change (`.mt-patch`)

On a deployed site too, settings are edited directly on the screen (the assistant's proposals are shown on the screen too). But the file cannot be written, so the save button becomes "PR 만들기" (create a PR) and the review sheet puts it up as a PR.

- Under the blocks of the review sheet, the changed lines of `monti.schema.ts` are shown. Head: the file name (mono 12) · the number of added lines (green).
- The body is mono 12/20. An added line `.add` (green ground, +), a removed line `.del` (red ground, −), the rest dimmed.
- Under the sheet: "PR로 올려요 · 합치고 배포하면 적용" (it goes up as a PR · applied when merged and deployed) + the pill "PR 만들기".
- After the PR is created, a band at the top of the screen keeps "PR #12 · … · 합치고 배포하면 적용돼요 · 보기" (PR #12 · … · applied when merged and deployed · view).
- There is one settings PR at a time. Everything changed in one save (review, then create PR) goes into it, and a proposal made by a ✦ request goes into the same save after it is accepted. While a PR is open, saving again does not make a new PR but adds to it (the button is "PR에 더하기" (add to the PR)). When it is merged or closed, the next save makes a new PR.
- If GitHub is not connected, it is read-only, and the band links to "연결" (connect).

### In code

`Patch`: what changes in one file, line by line. `file` is the name (mono), `lines` are `PatchLine`s of type `same`, `add` or `remove`; the head shows how many lines are added (green) and taken out (red). Added lines have a green ground and a +, removed lines a red one and a −; the lines around them are dimmed. `actionLabel` and `onAction` give one text button at the end of the head (copy).

## Collection list display

- A collection that has changed: `.mt-change-dot` beside its name.
- A collection to be deleted leaves the list at once; nothing is struck through. Until it is saved it can be taken back from "바뀐 곳 ▾" (the row "메모 · 컬렉션 지움 · 되돌리기") or from the notice "메모를 지웠어요 · 되돌리기".

### In code

`NavLink` is one link of the list: 36px, the name, the identifier at the end (mono, quiet), the open one on the current ground and semibold. `dot` names the change dot after the name, and `handle` (a `NavLinkHandle`) is the drag handle that shows in the left margin while the pointer is on the link. `RailLayout` puts the links (a `nav`) beside the content; narrow, the content wraps under them. `ChangeDot` (see Status) and `FieldRow changed` for the field outline (see List). There is no struck-through row: a collection that is to be deleted leaves the list.

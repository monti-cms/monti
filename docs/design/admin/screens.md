# Admin screens

This file lists the main screens (boards) on page "A · 가운데 단" of the Monti admin canvas, what each is for, its states, and which flow steps use it.

A state is a value of the board's main prop (`mode`, `stage`, `view`, `attempt`, ...). Flow step boards import a main board with one state; the "Used in" column gives those steps as `flow.step`. A state with no steps is not used by any flow. Component rules are in `components/`.

<a id="main"></a>
## Main: "게시글 목록"

- Board: `Main.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: The post list: rows of posts with columns, search, filters, folders, bulk actions and the right-click menus. Most list behaviour (sort, filter, columns, trash, folders) is shown as modes of this one board.
- Used in flows: 1.01, 2.01–2.03, 2.06, 2.10, 2.11, 2.16, 2.22, 2.23, 2.23b, 2.23c, 2.23d, 2.24–2.26, 3.12, 5.01–5.10, 7.01, 7.01b, 7.02, 7.02b, 7.02c, 7.03, 7.04, 7.04b, 7.04c, 7.04d, 7.04e, 7.05, 7.05b, 7.05c, 7.10, 9.04

States (`mode`, default "처음 화면"):

| State | Shows | Used in |
|---|---|---|
| "처음 화면" | The default list: post rows, status, title, address, tags, language, modified date; 25 per page. | 1.01, 2.01, 2.02, 2.06, 2.22, 2.23, 2.23b, 2.23c, 2.23d, 2.24–2.26 |
| "찾는 중" | Search text typed ("리액트"); the list is cut to the matches; the words stay in the search box, with no chip. | - |
| "여러 개 선택" | Two rows selected. A bulk bar replaces the column header: request, publish, archive, move to folder, change, clear selection. | - |
| "바꾸기 메뉴" | Bulk bar with the "바꾸기" menu open: tags with a tri-state mark (all selected, some such as 1/2, none). | 7.10 |
| "어시스턴트가 거름" | The assistant filtered the list; the filter chip "요약 비어 있음" is blue and two rows remain. | 2.03, 2.11, 2.16 |
| "거른 뒤 선택" | The assistant-filtered list with both rows selected by the user. | - |
| "AI가 고름" | Two rows selected by the assistant (blue) with the bulk bar. | 2.10 |
| "상태 메뉴" | Status column menu: published, editing, draft, archived with counts; a dot on the column name; hide column. | 7.04 |
| "여러 필터" | Several filters at once: status "수정 중, 초안" and modified date "최근 30일", a dot on each column name and no chip row. | 7.04e |
| "태그 메뉴" | Tag column menu: tag search, "없음" on top, each tag with its post count, hide column. | 7.04b |
| "언어 메뉴" | Language column menu: languages with counts (KO, EN, JA) and the translation filter (none, source changed, up to date); a dot on the column name. | 3.12, 7.04c |
| "수정일 메뉴" | Modified-date column menu: newest first, oldest first, today, last 7 days, last 30 days, pick a range; a dot on the column name. | 7.05 |
| "기간 고르기" | The range calendar opens beside the date menu; first click starts the range. | 7.05b |
| "기간 걸림" | Second click applied: the column has its dot and the calendar stays open showing the range. | 7.05c |
| "검색 설명 메뉴" | SEO description column (turned on with +) menu: "비어 있음" (empty); a dot on the column name. | 7.04d |
| "제목 메뉴" | Title column menu: ascending, descending. | 7.01 |
| "제목 오름차순" | Sorted ascending: the menu is closed and the title name is ink-colored with an up arrow. | 7.01b |
| "열 추가" | The + menu at the end of the header lists only the hidden columns. | 7.02 |
| "열 옮기는 중" | A column name is lifted and dragged; the other columns move aside; dropping saves the order. | 7.02b |
| "쪽마다" | The per-page control is open: 25, 50, 100 per page. | 7.02c |
| "휴지통 확인" | Confirm dialog for moving a published post to the trash (its publication ends, its translation goes too). | 5.10 |
| "휴지통으로 옮김" | After a trash move without confirm: the notice "휴지통으로 옮겼어요" with undo. | 5.09 |
| "행 메뉴" | Right-click menu on a row: open, open in new tab, duplicate, move to folder (expanded), archive, trash. | 5.07 |
| "여러 행 메뉴" | Right-click menu on a multi-row selection, titled with the count ("2개 항목"). | 5.08 |
| "폴더 우클릭" | Right-click menu on a folder row: open, rename, move to, delete folder. | 5.04 |
| "새 폴더" | A new folder row at the top with its name selected. | 5.01 |
| "폴더 안" | Inside a folder: its posts, the path and the "상위 폴더로" row. | 5.02 |
| "폴더 안 검색" | Search inside a folder; the scope switch reads "시리즈 원고 / 모든 폴더". | 5.03 |
| "폴더 지우기 확인" | Confirm dialog for deleting a folder that holds a published post. | 5.05 |
| "폴더 지움" | After the folder and its posts went to the trash: notice with undo. | 5.06 |
| "고른 글 내보냄" | Two selected posts exported from the ⋯ menu: notice "2편을 내보냈어요". | 9.04 |
| "찾을 곳 고르기" | The search scope picker before the search box: all, title, address, body. | 7.03 |
| "주소로 찾음" | Search by address for "-2": the two posts whose address got -2 after an import. | - |

<a id="editornotion"></a>
## EditorNotion: "글 편집기"

- Board: `EditorNotion.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: The post editor in the Notion style: title, body blocks, block handle and format card, slash menu, property panel (basic and SEO tabs), to-do panel, plugin strip, publish menu, status bar and the conflict or draft notices. It has many independent props instead of one state list.
- Used in flows: 1.02–1.16, 1.18, 2.04, 2.05, 2.07, 3.01, 3.08, 3.14, 5.18, 6.05, 6.06, 6.38

States (`state`, default "글자 고름 + 블록 메뉴"):

| State | Shows | Used in |
|---|---|---|
| "글자 고름 + 블록 메뉴" | Text selected: format card over it and the block handle menu open (default). | 1.03 |
| "블록 바꾸기" | Block handle › turn into: submenu of block types. | 1.04 |
| "블록 정렬" | Block handle › align: left, center, right. | 1.05 |
| "/ 를 쳤을 때" | The slash menu: search, block kinds (heading, list, quote, divider and so on). | - |
| "템플릿 고르기" | The slash menu's template list for a new post. | 1.02 |
| "아무것도 안 할 때" | Plain editor with nothing selected or open; the base for the status, to-do, toast and dialog props. | 1.06–1.16, 1.18, 2.04, 2.05, 2.07, 3.01, 3.08, 3.14, 5.18, 6.05, 6.06, 6.38 |

Other props:

- `panelTab` "기본" or "SEO": the property panel tab.
- `doc` "쓰던 글" or "새 글": an existing post or a new empty one.
- `pub` "초안", "발행됨", "수정 중": the publish status shown in the header.
- `save` "저장 전 변경사항", "저장됨", "브라우저에만 임시 저장됨", "편집 충돌": the status bar.
- `todo` "남음" or "다 채움": publish checks left or all filled.
- `fix` "없음", "요약", "대체 텍스트": which to-do is being fixed in the panel.
- `toast` "없음", "발행 막힘", "발행됨": the toast.
- `pubMenu`: the publish menu with keep-date and today's-date choices.
- `moreMenu` "없음", "열림", "본문 폭": the header ⋯ menu open, and its "본문 폭 ▸" second level open. The document tools are its middle group (see EditorTools).
- `trashed`: the read-only trashed-post view.
- `img` "없음", "올리는 중", "설정", "파일": the image or file block state.
- `panelFill`, `seriesPending`, `todoOpen`, `pluginOpen`, `panel`: panel and strip open states.
- `dialog` "없음", "편집 충돌", "임시 저장본 복구": the notice bar kind.
- `langMenu` "없음", "열림", "언어 하나뿐": the language tab menu.

<a id="editortranslate"></a>
## EditorTranslate: "글 편집기 · 번역"

- Board: `EditorTranslate.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: The editor for a translation of a post: dimmed blocks to decide on, AI translation proposals, margin marks where the source changed, publish checks.
- Used in flows: 3.02–3.04, 3.06, 3.07, 3.09–3.11, 3.15

States (`stage`, default "새 번역"):

| State | Shows | Used in |
|---|---|---|
| "새 번역" | A new translation: all blocks dimmed (source shown faintly), address copied, one to-do open. | 3.02 |
| "번역 제안" | AI translation arrived as 6 blue proposals; accept or discard each or all. | 3.03 |
| "블록 고르기" | A dimmed block's choice: translate, keep source ("원문 유지") or delete. | 3.04 |
| "발행 막힘" | Publish blocked because a dimmed block remains; to-do panel with "이동". | 3.06 |
| "발행됨" | Published: toast "발행되었어요" with view. | 3.07 |
| "원문 바뀜" | The source changed: banner (10. 26 · 3 places), margin marks changed, new, removed. | 3.09 |
| "바뀜 카드" | A margin mark opened: source before and after, with confirm and ✦ translate again. | 3.10 |
| "다시 번역" | The new translation of a changed block arrived as a blue proposal; status editing. | 3.11 |
| "번역 지우기" | The ⋯ menu with "이 번역 휴지통으로" and the note that the Korean source stays. | 3.15 |

<a id="editorproposal"></a>
## EditorProposal: "글 편집기 · AI 제안 (파란 연필)"

- Board: `EditorProposal.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: The post editor with AI edits shown as blue pencil marks and a memo card to adjust a proposal in place.
- Used in flows: 2.08, 2.09

Other props:

- `memoCard`: the memo card on a proposal, shown or hidden.
- `panelTab` "기본" or "SEO": the property panel tab.

<a id="translatepaired"></a>
## TranslatePaired: "번역 · 원문 나란히 (선택 보기)"

- Board: `TranslatePaired.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: A translation shown side by side with its source (the "원문 · 옆 창 · 나란히" view), block by block.
- Used in flows: 3.05

<a id="editorcompare"></a>
## EditorCompare: "글 편집기 · 비교 (충돌 · 임시 저장본)"

- Board: `EditorCompare.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: The compare screen for two versions of one post: your input or browser draft against the server copy; pick one side.
- Used in flows: 1.17, 1.19

States (`mode`, default "편집 충돌"):

| State | Shows | Used in |
|---|---|---|
| "편집 충돌" | Your unsaved input against the latest server version (v4, saved 10:41); load the server version or save your input. | 1.17 |
| "임시 저장본" | The browser-only draft (10. 26 10:12) against the server copy (10. 26 09:58); load the draft or discard it. | 1.19 |

In code it is the edit address with `?compare=conflict` or `?compare=draft`, drawn by the editor in place of its own screen, so the input that is not saved stays in the editor while it is compared. Only the properties that differ are listed on top of each side; the title and the body are compared word by word and block by block (`compareEntries`). The count in the header and in the status bar ("다른 곳 3") is the number of properties, the title and the body blocks that differ.

<a id="translate"></a>
## Translate: (untitled)

- Board: `Translate.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: An early draft of the translation editor, kept on the canvas but untitled and not used by any flow.
- Used in flows: none.

<a id="translatefill"></a>
## TranslateFill: (untitled)

- Board: `TranslateFill.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: An early draft of the translation fill state, kept on the canvas but untitled and not used by any flow.
- Used in flows: none.

States (`state`, default "제안 도착"):

| State | Shows | Used in |
|---|---|---|
| "흐린 원문" | Dimmed source before the request. | - |
| "제안 도착" | Translation proposals arrived. | - |

<a id="translateupdate"></a>
## TranslateUpdate: (untitled)

- Board: `TranslateUpdate.dc.html` (canvas row: "글 — 목록 · 편집 · 번역")
- Purpose: An early draft of the translation update state, kept on the canvas but untitled and not used by any flow.
- Used in flows: none.

States (`state`, default "제안 도착"):

| State | Shows | Used in |
|---|---|---|
| "요청 전" | Before the retranslate request. | - |
| "제안 도착" | New proposals arrived. | - |

<a id="empty"></a>
## Empty: "빈 목록 (첫 방문)"

- Board: `Empty.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: The empty list a collection shows before it has any entry, with the call to write the first one.
- Used in flows: 8.03

States (`collection`, default "메모"):

| State | Shows | Used in |
|---|---|---|
| "메모" | Empty notes collection: "아직 메모가 없어요." with "첫 메모 쓰기". | - |
| "게시글" | Empty posts collection: "아직 글이 없어요." with "첫 글 쓰기". | 8.03 |

<a id="dialogs"></a>
## Dialogs: "대화상자 · 내보내기와 확인"

- Board: `Dialogs.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: Reference sheet of two shared dialogs: export selected posts (purpose, file kind, what is included), and move to trash, plus the unsaved-changes dialog.
- Used in flows: none.

<a id="assistant"></a>
## Assistant: "어시스턴트 패널"

- Board: `Assistant.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: The post list with the assistant panel open and one proposal card in it, pending review or applied. Superseded by AssistantPanel states in the flows.
- Used in flows: none.

States (`proposal`, default "검토 대기"):

| State | Shows | Used in |
|---|---|---|
| "검토 대기" | A proposal card pending review: review, discard, apply. | - |
| "적용됨" | The same card applied: "✓ 2편에 적용" with undo. | - |

<a id="proposalreview"></a>
## ProposalReview: "어시스턴트 · 제안 검토 (여러 곳에 걸친 제안)"

- Board: `ProposalReview.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: The review screen for an assistant proposal that touches many places or posts: one row per change, with apply, progress and result.
- Used in flows: 2.12–2.15, 3.13

States (`stage`, default "검토"):

| State | Shows | Used in |
|---|---|---|
| "검토" | The review: one line per change, discard and "14건 적용" (default stage). | 2.12, 2.13, 3.13 |
| "적용 중" | Applying: progress 9 of 14. | 2.14 |
| "결과" | Result: 13 applied, 1 failed with the reason, "모두 되돌리기". | 2.15 |

Other props:

- `view` "한 줄" or "나란히": one line per change, or now and proposal side by side.
- `kind` "여러 작업" or "번역": a multi-action proposal, or a translation proposal (original and translation per post).

<a id="proposalreviewside"></a>
## ProposalReviewSide: "어시스턴트 · 제안 검토 · 나란히"

- Board: `ProposalReviewSide.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: The proposal review in its side-by-side view (now and proposal next to each other). Same board as ProposalReview with view "나란히".
- Used in flows: none directly (see Purpose for the board that shows this screen).

<a id="assistantfirst"></a>
## AssistantFirst: "어시스턴트 · 처음 열었을 때"

- Board: `AssistantFirst.dc.html` (canvas row: "글 — 첫 방문 · 대화상자 · 어시스턴트")
- Purpose: The editor with the assistant opened for the first time on a post: starter requests for this post.
- Used in flows: none.

<a id="taxonomy"></a>
## Taxonomy: "카테고리 · 항목 열기"

- Board: `Taxonomy.dc.html` (canvas row: "분류 · 미디어 · 휴지통")
- Purpose: Categories and tags: the list of entries with post counts, selection, merging tags.
- Used in flows: 7.06–7.09

States (`stage`, default "카테고리"):

| State | Shows | Used in |
|---|---|---|
| "카테고리" | The categories list with name, address, description and counts, and "카테고리 추가". | - |
| "태그" | The tags list with post counts, including tags no post uses. | 7.06 |
| "태그 고름" | Two tags selected: bar with merge, trash, clear selection. | 7.07 |
| "태그 합치기" | Merge dialog: which name to keep, how many posts change, which address disappears. | 7.08 |
| "태그 합침" | After merging: updated count and the notice with undo. | 7.09 |

<a id="media"></a>
## Media: "미디어"

- Board: `Media.dc.html` (canvas row: "분류 · 미디어 · 휴지통")
- Purpose: The media library: folders, files, upload and drag-drop, list view, search, filters (alt text, kind), file side panel, replace, bulk actions, alt text proposals.
- Used in flows: 2.19, 6.01–6.04, 6.07–6.28, 6.31–6.36

States (`mode`, default "폴더 안"):

| State | Shows | Used in |
|---|---|---|
| "최상위" | Library top level: folders and files not in any folder. | 6.07 |
| "폴더 안" | Inside a folder (Blog Assets): sub-folders and files (default). | 6.08 |
| "필터 열기" | Filter menu: alt text none or present. | 6.22 |
| "새 폴더" | New folder in place with its name selected. | 6.09 |
| "폴더 우클릭" | Right-click menu on a folder: open, rename, move to, delete folder. | 6.10 |
| "폴더 지움" | Folder moved to the trash without confirm; notice with undo. | 6.11 |
| "폴더 일부 남김" | Folder delete when some files are in use: only unused files moved; notice with view. | 6.12 |
| "빈 곳 우클릭" | Right-click on empty space: upload, new folder. | 6.13 |
| "파일 메뉴" | Right-click menu on a file: open, used in (posts), move to folder. | 6.17 |
| "하위 폴더" | A folder with sub-folders and files (covers). | - |
| "목록 보기" | List view: name, use, type, size, dimensions, uploaded date. | 6.14 |
| "끌어 놓기" | Dragging files over the library: border on the current folder and the pill "여기에 올려요". | 6.01 |
| "폴더 위로 끌기" | Dragging over a sub-folder: only that folder is highlighted, the pill names it. | 6.02 |
| "올리는 중" | Upload in progress: per-file progress or waiting. | 6.03 |
| "올리기 실패" | Failed uploads stay in place: unsupported type (remove), too large (shrink and retry, remove). | 6.04 |
| "파일 열기" | Side panel for a file: address, name, folder, alt text, caption, type, size, date, used in. | 6.16 |
| "바꾸기 메뉴" | Side panel ⋯ menu: replace file, copy ID, move to trash (the address actions are in the body). | 6.18 |
| "파일 바꾸기" | The chosen replacement file confirmed; the places using it will use the new file. | 6.19 |
| "여러 개 선택" | Two files selected: bulk bar with move to folder, trash, clear. | 6.20 |
| "폴더로 옮기기" | Bulk bar "폴더로" menu: top level, folders, new folder. | 6.21 |
| "찾는 중" | Search for "cover", scope widened to all folders, folder path shown on each result. | 6.15 |
| "필터 걸림" | Chip "대체 텍스트: 없음 ×" applied; scope "Blog Assets / 모든 폴더". | 6.23 |
| "대체 텍스트 없는 것 고름" | All files without alt text selected (3). | 2.19, 6.24 |
| "대체 텍스트 제안" | Three blue alt text proposals with discard all and accept all. | 6.25 |
| "대체 텍스트 메모" | One proposal opened for a memo and rewritten in place. | 6.26 |
| "휴지통으로 옮김" | A file moved to the trash; notice with undo. | 6.27 |
| "일부 남김" | Delete with some files in use: used files stay; notice with view. | 6.28 |
| "저장소 없음" | No media storage: explanation and "연결 방법". | 6.31 |
| "종류 열기" | Kind filter menu: images, files. | 6.32 |
| "종류 파일" | Kind "파일" applied: files only, chip "종류: 파일", no alt text filter. | 6.33 |
| "PDF 올리는 중" | Uploading PDF and other files: file icon with type instead of a preview. | 6.34 |
| "받지 않는 형식" | A rejected type (.exe) stays in place with the accepted kinds line and remove. | 6.35 |
| "PDF 열기" | Side panel for a PDF: name, type, size, date, used in, copy address, replace, trash; no alt text. | 6.36 |

<a id="trash"></a>
## Trash: "휴지통"

- Board: `Trash.dc.html` (canvas row: "분류 · 미디어 · 휴지통")
- Purpose: The trash: deleted posts, notes, tags and media with days left, deleted folders as one row, restore, permanent delete, empty trash, kind filter.
- Used in flows: 5.11–5.17, 5.19–5.28

States (`stage`, default "보통"):

| State | Shows | Used in |
|---|---|---|
| "보통" | The trash: one head row title, kind, deleted date (the cell shows the day alone, "10. 27"); rows with days left; folders as one row (default). | - |
| "종류 메뉴" | The kind column menu: every kind with its count, several choosable, stays open. | 5.11 |
| "행 메뉴" | Right-click menu on a row: restore, permanent delete. | 5.16 |
| "어시스턴트" | Items the assistant discarded have a ✦ before their day. | 5.15 |
| "미디어" | Filtered by kind "미디어": a dot after "종류" and media rows only; no chip row. | 5.17 |
| "항목 열기" | Side panel for a trashed item (a tag): read-only, posts that point to it, restore, delete. | 5.19 |
| "미디어 열기" | Side panel for a trashed media file: preview, details, used in, restore, delete. | 5.20 |
| "복원함" | Notice after restore: back as a draft, with open. | 5.21 |
| "번역 막힘" | A translation whose source is in the trash: the action is "원문 복원". | 5.22 |
| "삭제 확인" | Permanent delete confirm; a once-published address stays reserved. | 5.23 |
| "삭제 막힘" | Permanent delete blocked by posts that point to the item: cut links or delete them too. | 5.24 |
| "선택" | Rows selected: bulk bar with restore, delete, clear. | 5.25 |
| "비우기 확인" | Empty-trash confirm: 9 items, pointed-to items are kept with the reason. | 5.26 |
| "비운 뒤" | After emptying: blocked items remain with their reason; notice 6 deleted, 1 kept. | 5.27 |
| "빔" | Empty trash message. | 5.28 |
| "휴지통 폴더 안" | Inside a deleted folder: contents, path, folder restore, delete. | 5.12 |
| "폴더에서 하나 복원" | One post restored from a deleted folder: folder recreated, post back as draft. | 5.13 |
| "휴지통 찾기" | Search in the trash includes items inside deleted folders, with their path; the words stay in the search box, with no chip. | 5.14 |

<a id="imageinsert"></a>
## ImageInsert: "글 편집기 · 이미지 넣기"

- Board: `ImageInsert.dc.html` (canvas row: "분류 · 미디어 · 휴지통")
- Purpose: The picker the editor opens to insert an image, a cover image or a file from the media library.
- Used in flows: 6.29, 6.30, 6.37

States (`stage`, default "라이브러리"):

| State | Shows | Used in |
|---|---|---|
| "라이브러리" | Library picker from the editor's slash menu; choosing an image inserts it. | 6.29 |
| "대표 이미지" | The same picker opened from the cover image field, with a pick action. | 6.30 |
| "파일" | File picker: files only (PDF, CSV, ZIP, MD) with a type filter. | 6.37 |

<a id="templates"></a>
## Templates: "도구 · 템플릿"

- Board: `Templates.dc.html` (canvas row: "도구")
- Purpose: Tools › Templates: the list of post templates. A row holds the name (the way into the template's page), its headings in one line, the day it was edited ("10. 20 고침") and a ⋯ with duplicate and delete. "+ 템플릿 추가" is in the page header. The page is the content width (880), not a wide list.
- Used in flows: none. Test: `packages/admin/src/screens/templates/__test__/templates-flow.test.tsx` ("flow: templates · the list", "· a row's menu").

<a id="templateeditor"></a>
## TemplateEditor: "도구 · 템플릿 편집기"

- Board: `TemplateEditor.dc.html` (canvas row: "도구")
- Purpose: The template editor, a page of its own (`/templates/new`, `/templates/<id>/edit`), outside the tools page: the "템플릿" back link, "저장 안 됨" (only while something is changed) and "저장" (always there, drawn like the entry editor's header save; no shortcut on it), a ⋯ with duplicate and delete (not on a new template), the assistant button, the name field over the reading-width body with the one ink rule under it (20 above, 32 below), and a status bar with the character count only. A save refused because the template changed elsewhere shows the notice strip (Banner, "다른 곳에서 먼저 저장했어요", "서버 최신본 불러오기"); a failed load shows the shared load-error strip with a retry.
- Used in flows: none. Test: `packages/admin/src/screens/templates/__test__/templates-flow.test.tsx` ("flow: templates · the editor page", "· a new template").

<a id="data"></a>
## Data: "도구 · 데이터"

- Board: `Data.dc.html` (canvas row: "도구")
- Purpose: Tools › Data: download a backup, import a zip (posts from files or a full restore).
- Used in flows: 9.01–9.03, 9.05–9.09, 9.11–9.15

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | Backup section (last backup, include media option) and the import drop area. | 9.01 |
| "백업 중" | The backup button shows progress. | 9.02 |
| "백업 받음" | Backup saved: notice and the last backup is today. | 9.03 |
| "읽는 중" | A zip was dropped; "읽는 중…". | 9.05 |
| "못 읽음" | The file could not be read. | 9.11 |
| "가져오기" | Import summary: found posts, skip and -2 rule, destination, field mapping. | 9.06 |
| "가져오기 아래" | The lower part of the import sheet: publish status, images, notes, import button. | 9.07 |
| "가져오는 중" | Importing in progress. | 9.08 |
| "가져옴" | Import result with the changed-address list, undo, view in list. | 9.09 |
| "복원" | Restore on an empty site: backup summary and "있던 그대로 복원". | 9.12 |
| "복원 막힘" | Restore blocked: problems listed (unknown field, overlapping address); nothing written. | 9.13 |
| "복원 중" | Restoring in progress. | 9.14 |
| "복원함" | Restore done: 148 posts restored, view the list. | 9.15 |

<a id="apikeys"></a>
## ApiKeys: "도구 · API 키"

- Board: `ApiKeys.dc.html` (canvas row: "도구 (계속) · 로그인")
- Purpose: Tools › API keys: stored AI keys, the quick-task model, and the plugin key slots. Add, edit and delete keys, plus the secret problems.
- Used in flows: 10.01, 10.02, 10.02b, 10.03–10.11, 10.11b, 10.12, 10.12b, 10.13, 10.13b, 10.14, 10.14b, 10.15

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | Stored keys with last four characters and monthly use, quick-task model, plugin key slots (default). | - |
| "서비스 고르기" | Service picker for a new key. | 10.01 |
| "키 입력" | Add dialog: name filled from the service, key field. | 10.02 |
| "호환 주소" | Add dialog for an OpenAI-compatible address: extra address field, name from the host. | 10.02b |
| "확인하는 중" | Add dialog while the service checks the key. | 10.03 |
| "키 거절" | The service rejected the key: one line under the key field, dialog stays open. | 10.04 |
| "이름 겹침" | A key with the same name exists: name becomes "Anthropic 2" and one line explains. | 10.05 |
| "추가됨" | Key added: new row and toast. | 10.06 |
| "편집" | Edit dialog: service as text, name, key shown as "··· a1b2" with change. | 10.07 |
| "편집 키 열기" | Edit dialog with the empty key field open; "그대로" restores the old one. | 10.08 |
| "편집 확인 중" | Edit dialog while the new key is checked. | 10.09 |
| "편집 저장됨" | Edit saved: new last four characters, toast. | 10.10 |
| "지우기 확인" | Delete confirm listing the places that use the key (red delete). | 10.11 |
| "쓰는 곳 없이 지우기" | Delete confirm for an unused key. | 10.11b |
| "키 넣기" | Plugin key slot: add key dialog with the service chosen. | 10.12 |
| "키 넣음" | Plugin key added: the slot shows the key name, toast. | 10.12b |
| "모델 고르기" | Quick-task model menu: search, models grouped by key. | 10.13 |
| "모델 바뀜" | Quick-task model changed: row and toast. | 10.13b |
| "읽을 수 없음" | Banner: keys unreadable because the server secret changed; each row marked. | 10.14 |
| "다시 넣기" | Edit of an unreadable key: key field focused, key required. | 10.14b |
| "비밀값 없음" | Banner: MONTI_SECRET is missing; adding keys blocked. | 10.15 |

<a id="events"></a>
## Events: "도구 · 활동 기록"

- Board: `Events.dc.html` (canvas row: "도구 (계속) · 로그인")
- Purpose: Tools › Activity log: every event (AI changes, saves, publishes, trash, imports, settings, media) with delivery status to recipients, resend, cancel, details and filters.
- Used in flows: 2.17, 2.18, 9.10, 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05–12.09, 12.09b, 12.10, 12.11

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | The activity log, unfiltered (default). | 2.17, 2.18, 9.10 |
| "실패만" | Filter kind › delivery › failed applied; chip "전송: 실패 ×". | 12.01b |
| "다시 보내는 중" | A row shows "보내는 중…" while resending. | 12.02 |
| "다시 보냄" | Resent: the filtered list is empty, "필터 끄기", toast. | 12.02b |
| "자세히" | Side panel with the event, item, and deliveries per recipient. | 12.03 |
| "취소 확인" | Confirm dialog for cancelling a delivery. | 12.04 |
| "취소됨" | The delivery is "취소됨"; toast. | 12.04b |
| "실패 알림" | Notice above the list: 1 delivery failed, view, resend all. | 12.01 |
| "실패 3건" | Three failures with "N번 실패" on each row; the notice shows 3. | 12.05 |
| "모두 보내는 중" | Resend all in progress; notice and failed rows show sending. | 12.06 |
| "모두 보냄" | All resent: notice gone, toast "3건 보냈어요". | 12.07 |
| "일부 실패" | Some failed again: notice "전송 실패 1건", toast with the split. | 12.08 |
| "필터 메뉴" | Kind filter menu with the delivery group. | 12.09 |
| "필터 걸림" | Delivery filter chip "전송: 대기 ×". | 12.09b |
| "구독자 없음" | A site with no recipients: records only. | 12.10 |
| "비어 있음" | No records yet. | 12.11 |

Other props:

- `filter` "전체", "전송 실패", "글 하나": a preset filter (used by flow 2 step 18).
- `withImport`, `importDetail`, `detail`: the import line and the side panel (used by flow 9 step 10).

<a id="login"></a>
## Login: "로그인"

- Board: `Login.dc.html` (canvas row: "도구 (계속) · 로그인")
- Purpose: The sign-in screen and the first-admin screen of a fresh install, with their errors.
- Used in flows: 8.01, 8.02, 8.04–8.10

States (`attempt`, default "처음"):

| State | Shows | Used in |
|---|---|---|
| "처음" | Sign-in: email and password, or GitHub (default). | 8.05 |
| "한 번 틀림" | Wrong credentials message. | 8.06 |
| "잠김" | Blocked for one minute after 5 wrong attempts. | 8.07 |
| "첫 관리자" | Create the first admin: email, password, confirm. | 8.01 |
| "첫 관리자 오류" | First admin field errors. | 8.02 |
| "이미 있음" | An admin already exists; go to sign-in. | 8.04 |
| "GitHub만" | GitHub-only sign-in. | 8.08 |
| "GitHub 권한 없음" | The GitHub account is not an admin. | 8.09 |
| "로그인 없음" | No sign-in method configured. | 8.10 |

<a id="settings"></a>
## Settings: "설정 · 사이트"

- Board: `Settings.dc.html` (canvas row: "설정")
- Purpose: Settings › Site: host names, preview path and the other site settings, with save or PR behaviour by site kind.
- Used in flows: 2.20, 11.01–11.04, 11.09, 11.13, 11.15, 11.15b

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | Settings › Site, as stored (default). | 2.20 |
| "호스트 추가" | A new host name typed in the row. | 11.01 |
| "언어 쿼리" | Preview language query field shown after turning off the language in the preview path. | 11.02 |
| "칸 오류" | Field error under a host name row; saving blocked. | 11.03 |
| "나가기 확인" | Leave dialog for unsaved changed places. | 11.04 |
| "운영 글 쓰는 방식" | Production with the GitHub plugin: writing rules edited, button "저장". | 11.09 |
| "운영 검토" | Review that marks which changes save directly and which go to the PR. | 11.13 |
| "읽기 전용" | Production without the plugin: only the public address locked. | 11.15 |
| "읽기 전용 저장" | Production without the plugin: site name edited, button "저장". | 11.15b |

<a id="locales"></a>
## Locales: "설정 · 언어"

- Board: `Locales.dc.html` (canvas row: "설정")
- Purpose: Settings › Languages: the language list, source language, adding and removing languages.
- Used in flows: 11.05, 11.06, 11.06b, 11.07, 11.07b, 11.08, 11.16

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | The language list (default). | - |
| "언어 찾기" | Add language: code finder, last item "직접 입력". | 11.05 |
| "직접 입력" | Small dialog for code, native name and display name. | 11.06b |
| "언어 추가됨" | A language row added at once; listed in the changes bar. | 11.06 |
| "원문 메뉴" | Source-language picker. | 11.07 |
| "원문 바꿈" | A new source language moved to the top; two rows marked changed. | 11.07b |
| "빼기 검토" | Review when removing a language that has translations: keep or move to the trash. | 11.08 |
| "읽기 전용" | Production without the plugin: list locked, only the time zone editable. | 11.16 |

<a id="adminsettings"></a>
## AdminSettings: "설정 · 관리자"

- Board: `AdminSettings.dc.html` (canvas row: "설정")
- Purpose: Settings › Admin: the admin address and the admin interface language.
- Used in flows: 11.18

States (`stage`, default "기본"):

| State | Shows | Used in |
|---|---|---|
| "기본" | Admin address and interface language, editable (default). | - |
| "읽기 전용" | Production without the plugin: only the admin address locked. | 11.18 |

<a id="settingsproposal"></a>
## SettingsProposal: "설정 · AI 제안"

- Board: `SettingsProposal.dc.html` (canvas row: "설정")
- Purpose: Settings › Site with assistant proposals marked on the changed fields, awaiting save and apply.
- Used in flows: 2.21

<a id="collectionbasics"></a>
## CollectionBasics: "설정 · 컬렉션 · 기본"

- Board: `CollectionBasics.dc.html` (canvas row: "설정 — 컬렉션")
- Purpose: Settings › Collections, "기본" tab of one collection: display name, folders, structure, identifier, kind, public address, delete. Same board as Schema with tab "기본".
- Used in flows: none directly (see Purpose for the board that shows this screen).

<a id="schema"></a>
## Schema: "설정 · 컬렉션 · 필드"

- Board: `Schema.dc.html` (canvas row: "설정 — 컬렉션")
- Purpose: Settings › Collections: the field list of a collection, the field sheet, the new-collection form, the changes review, delete, and the production variants (PR, locks, conflict). Most collection flows are stages of this one board.
- Used in flows: 4.01–4.19, 11.10–11.12, 11.14, 11.14b, 11.17, 11.17b, 11.17c, 11.19, 11.20

States (`stage`, default "보통"):

| State | Shows | Used in |
|---|---|---|
| "보통" | The field list of a collection (default tab "필드"). | - |
| "새 컬렉션" | New collection form: name, identifier, kind, public address. | 4.01 |
| "새 컬렉션 오류" | The identifier is already used. | 4.02 |
| "만든 직후" | The new collection with title and slug, not yet saved. | 4.03 |
| "필드 추가" | Add-field sheet on an existing collection (text, choice, relation, advanced). | - |
| "노트 필드 추가" | Add-field sheet on the new collection (text kind). | 4.04 |
| "새 컬렉션 검토" | Review for a new collection: public address, fields, data untouched. | 4.05 |
| "만듦" | Collection created: notice with view. | 4.06 |
| "필드 바꿈" | Field list with a rename, a removal and a new required field marked; 3 changes. | 4.07 |
| "미리보기" | Property panel preview of the new fields, not saved. | 4.08 |
| "미리보기 오류" | Preview replaced by a list of problems; save and apply blocked. | 4.09 |
| "바뀐 곳 목록" | The changes list open, each change with undo. | 4.10 |
| "필드 검토" | Review: value handling per change (move, keep, delete, fill). | 4.11 |
| "값 지우기" | Review with delete-values chosen: red "지우고 적용". | 4.12 |
| "주소 바꿈" | Basic tab: public address edited. | 4.13 |
| "주소 검토" | Review: address before and after, published posts affected. | 4.14 |
| "지우기 전" | Basic tab with the delete action and counts. | 4.15 |
| "지울 예정" | The collection left the list at once; "바뀐 곳 ▾" lists it with undo, and a notice has undo. | 4.16 |
| "지우기 검토" | Delete review: what goes (links cut on apply) and the export; "지우고 적용" on. | 4.17 |
| "지운 뒤" | After the save: the notice "적용됐어요" (one line for every save) and the collection gone. | 4.18 |
| "운영 고침" | Production with the GitHub plugin: field added, button "PR 만들기". | 11.10 |
| "운영 제안" | A field proposal from the assistant marked "✦ 제안". | 11.11 |
| "운영 검토" | Review with the file change to monti.schema.ts and "PR 만들기". | 11.12 |
| "PR 만듦" | An open PR row (PR #12) and the created notice. | 11.14 |
| "PR에 더하기" | A PR is open: button "PR에 더하기". | 11.14b |
| "읽기 전용" | Production without the plugin: structure locked, views and layout editable. | 11.17, 11.17c |
| "읽기 전용 필드" | A field's sheet: label and description editable, structure locked. | 11.17b |
| "적용 실패" | Banner: file saved but the database apply failed; apply again, reload. | 11.20 |
| "충돌" | Banner: the schema file changed after opening; reload. | 11.19 |

Other props:

- `tab` "필드" or "기본": the collection tab.
- `sheet`, `review`, `sheetKind` "관계", "글자", "고르기": the field sheet and the review open, and the sheet kind.

<a id="collectioneditor"></a>
## CollectionEditor: "설정 · 컬렉션 · 에디터"

- Board: `CollectionEditor.dc.html` (canvas row: "설정 — 컬렉션")
- Purpose: Settings › Collections, "에디터" tab: which blocks, marks and heading levels the editor allows for this collection.
- Used in flows: none.

<a id="schemaaddfield"></a>
## SchemaAddField: "설정 · 컬렉션 · 필드 추가"

- Board: `SchemaAddField.dc.html` (canvas row: "설정 — 컬렉션")
- Purpose: Settings › Collections with the add-field sheet open. Same board as Schema with stage "필드 추가".
- Used in flows: none directly (see Purpose for the board that shows this screen).

<a id="schemareview"></a>
## SchemaReview: "설정 · 컬렉션 · 저장 검토"

- Board: `SchemaReview.dc.html` (canvas row: "설정 — 컬렉션")
- Purpose: Settings › Collections with the changes review open. Same board as Schema with stage "필드 검토".
- Used in flows: none directly (see Purpose for the board that shows this screen).

<a id="foundations"></a>
## Foundations: "규칙 · 토큰"

- Board: `Foundations.dc.html` (canvas row: "규칙과 공용 부품")
- Purpose: Reference sheet of the visual rules: paper-and-ink colors, status colors, type scale, spacing. Not a screen.
- Used in flows: none.

<a id="sidebar"></a>
## Sidebar: "사이드바 (공용)"

- Board: `Sidebar.dc.html` (canvas row: "규칙과 공용 부품")
- Purpose: The shared sidebar (232 px wide): site name, collections with counts, folders, media, trash, tools, settings. Shown for the states of its props.
- Used in flows: none.

Other props:

- `active`: which entry is current (posts, memo, category, tag, series, media, media-folder, media-covers, trash, tools, settings, none).
- `rail`, `railTip`: collapsed to a rail, with the hover tip.
- `theme` "system", "light", "dark" and `themeMenu`: the screen-mode menu.
- `trashCount`, `toolsCount`, `blogCount`, `coversCount`: the numbers beside entries.
- Other boolean props (`noMemo`, `noDiagrams`, `noPostFolders`, `postFolderOn`, `withNote`, `fresh`) switch which collection and folder entries are listed.

<a id="assistantpanel"></a>
## AssistantPanel: "어시스턴트 패널 · 상태 (공용)"

- Board: `AssistantPanel.dc.html` (canvas row: "규칙과 공용 부품")
- Purpose: The shared assistant panel (380 px wide). Flow boards render it beside a main screen; its view prop decides what the conversation shows.
- Used in flows: 2.01–2.07, 2.10, 2.11, 2.16, 2.19, 2.21–2.23, 2.23b, 2.23c, 2.23d, 2.24–2.26, 11.11

States (`view`, default "처음"):

| State | Shows | Used in |
|---|---|---|
| "처음" | Starter requests for this list and recent requests (default). | 2.01 |
| "묻는 중" | A request running with tool lines and progress. | 2.02 |
| "목록 거름" | Answer after filtering the list. | 2.03 |
| "글 엶" | The assistant opened a post; the conversation continues. | 2.04 |
| "이동 막힘" | Move refused because of unsaved edits; "저장하고 열기". | 2.05 |
| "실패" | Connection lost: how far it got, "이어서 하기". | 2.06 |
| "글에서 요청" | A request typed from inside a post. | 2.07 |
| "맡기기" | The assistant selected two posts. | 2.10 |
| "제안 카드" | A proposal card: groups, count, details, discard, apply; irreversible items left out. | 2.11 |
| "적용됨" | The applied card with undo. | 2.16 |
| "대체 텍스트" | A request to fill alt text for selected images with a pending proposal. | 2.19 |
| "설정 제안" | A settings change marked on the settings screen; saves on apply. | 2.21 |
| "스키마 변경" | A collection field proposal; on this site saving opens a PR. | 11.11 |
| "키 없음" | No AI connection; "API 키 넣기". | 2.22 |
| "모델 고르기" | Model menu: search, models grouped by key, thinking row. | 2.23 |
| "생각 고르기" | Thinking sub-menu: off, low, medium, high. | 2.23b |
| "생각 높음" | Thinking set to high; the model button shows it. | 2.23c |
| "생각 없는 모델" | A model that cannot think: no thinking row. | 2.23d |
| "크레딧 부족" | Out of credit notice; "다른 모델로 보내기". | 2.24 |
| "지난 대화" | Chat history by day, delete, auto-delete after 30 days. | 2.25 |
| "다시 연 대화" | A reopened chat with its old proposal as it was. | 2.26 |

<a id="sidebarrail"></a>
## SidebarRail: "사이드바 · 접힘"

- Board: `SidebarRail.dc.html` (canvas row: "규칙과 공용 부품")
- Purpose: The sidebar collapsed to a rail, with a hover tip. Same board as Sidebar with rail on.
- Used in flows: none directly (see Purpose for the board that shows this screen).

<a id="sidebartheme"></a>
## SidebarTheme: "사이드바 · 화면 모드"

- Board: `SidebarTheme.dc.html` (canvas row: "규칙과 공용 부품")
- Purpose: The sidebar in dark mode, expanded and as a rail with the screen-mode menu (system, light, dark).
- Used in flows: none directly (see Purpose for the board that shows this screen).

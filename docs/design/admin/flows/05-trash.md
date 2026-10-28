# Flow 5: Trash

This file lists every row and step of canvas flow 5, "흐름 5 · 휴지통". Folders in the post list, discarding, browsing the trash, restoring, permanent delete, handling many items and emptying the trash.

Canvas note: "흐름 5 · 휴지통 — 버리기 · 보기 · 복원 · 영구 삭제 · 여러 개 · 비우기". The 30-day auto-empty and the media trash are part of E2 (#276).

Screens used: [`Main`](../screens.md#main), [`Trash`](../screens.md#trash), [`EditorNotion`](../screens.md#editornotion).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "목록의 폴더" · Folders in the list

### Step 01: "목록 · + 폴더 → 맨 위에 새 폴더 행 · 이름이 골라진 채로"

- Board: `Flow5Step01.dc.html`
- Renders: `Main` (mode "새 폴더")
- In the post list the user presses "+ 폴더". A new folder row appears at the top with its name selected, ready to type over.
- Test: `packages/admin/src/screens/__test__/list-folders-flow.test.tsx`

### Step 02: "목록 · 폴더 안 · 경로 · 상위 폴더로"

- Board: `Flow5Step02.dc.html`
- Renders: `Main` (mode "폴더 안")
- The user opens a folder. The list shows only that folder's posts, a path above the list, and a "상위 폴더로" (up one folder) row.
- Test: `packages/admin/src/screens/__test__/list-folders-flow.test.tsx`

### Step 03: "목록 · 폴더 안에서 찾기 → 찾는 곳 시리즈 원고 | 모든 폴더"

- Board: `Flow5Step03.dc.html`
- Renders: `Main` (mode "폴더 안 검색")
- Searching inside a folder. The search covers the current folder by default; a scope switch reads "찾는 곳 시리즈 원고 | 모든 폴더" (search in: this folder | all folders) and the user can widen it.
- Test: `packages/admin/src/screens/__test__/list-folders-flow.test.tsx`

### Step 04: "목록 · 폴더 행을 우클릭 → 열기 · 이름 바꾸기 · 옮기기 ▸ · 폴더 지우기"

- Board: `Flow5Step04.dc.html`
- Renders: `Main` (mode "폴더 우클릭")
- The user right-clicks a folder row. The menu offers open, rename, move to ▸ and delete folder.
- Test: `packages/admin/src/screens/__test__/list-folders-flow.test.tsx`

### Step 05: "목록 · 폴더 지우기 → 공개 중인 글이 있으면 확인"

- Board: `Flow5Step05.dc.html`
- Renders: `Main` (mode "폴더 지우기 확인")
- The user deletes a folder that holds published posts. A confirm dialog says the folder's 2 posts move to the trash too and the 1 published post comes off the site; buttons are cancel and "휴지통으로" (to trash).
- Test: `packages/admin/src/screens/__test__/safe-delete.test.tsx` (the confirm) and `packages/admin/src/screens/__test__/list-folders-flow.test.tsx`

### Step 06: "목록 · 폴더와 글을 휴지통으로 · 되돌리기 (초안만 있으면 확인 없이 바로)"

- Board: `Flow5Step06.dc.html`
- Renders: `Main` (mode "폴더 지움")
- The folder and its posts are moved to the trash. A notice says so with "되돌리기" (undo). A folder that holds only drafts skips the confirm and goes straight to this step.
- Test: `packages/admin/src/screens/__test__/safe-delete.test.tsx`

## "버리기" · Discard

### Step 07: "버리기 · 행을 우클릭 → 메뉴 (폴더로 ▸ 펼침)"

- Board: `Flow5Step07.dc.html`
- Renders: `Main` (mode "행 메뉴")
- The user right-clicks a post row. The menu offers open, open in new tab, duplicate, move to folder ▸ (expanded: top level and the folders), archive, and trash (Del).

### Step 08: "버리기 · 여러 행을 골라 우클릭 → 2개 항목 메뉴"

- Board: `Flow5Step08.dc.html`
- Renders: `Main` (mode "여러 행 메뉴")
- The user selects several rows and right-clicks. The menu is titled with the count ("2개 항목") and offers the bulk actions: change (tags), archive, move to folder, trash, export.

### Step 09: "버리기 · 초안 · 메모는 확인 없이 바로 휴지통으로 → 되돌리기"

- Board: `Flow5Step09.dc.html`
- Renders: `Main` (mode "휴지통으로 옮김")
- Drafts and notes go to the trash without asking. A notice says "휴지통으로 옮겼어요" with "되돌리기".

### Step 10: "버리기 · 공개 중인 글만 확인 · 사이트에서 내려가고 번역도 함께 (복원하면 초안)"

- Board: `Flow5Step10.dc.html`
- Renders: `Main` (mode "휴지통 확인")
- A published post asks first. The confirm says its publication ends and its English translation moves to the trash with it; restoring brings it back as a draft. Buttons: cancel, "휴지통으로".

## "휴지통 둘러보기" · Browse the trash

### Step 11: "휴지통 · 지운 폴더는 한 줄 · 버린 날 · n일 남음(30일) · 종류 열로 거르기"

- Board: `Flow5Step11.dc.html`
- Renders: `Trash` (stage "종류 메뉴")
- The trash screen. A head row reads title, kind ("종류"), deleted date ("버린 날", sorted newest first). Each row shows the title, a kind column (posts, notes, tags, media), the day it was deleted (the day alone, "10. 27"; the column's name says what it is) and days left out of 30; a deleted folder is one row. The user opens the "종류" column menu to filter by kind: it lists every kind with its count (posts 5, notes 1, categories 0, tags 1, media 2), several can be chosen at once, and the menu stays open. A filter that is on shows only as the dot after "종류"; there is no chip row. The header has search and "비우기" (empty trash). The row meta line does not start with the kind; the kind has its own column.

### Step 12: "휴지통 · 폴더를 누르면 안으로 · 경로 · 상위 폴더로 · 폴더 복원 · 영구 삭제"

- Board: `Flow5Step12.dc.html`
- Renders: `Trash` (stage "휴지통 폴더 안")
- The user opens a deleted folder. The list shows its contents, the folder's path, "상위 폴더로", and header actions for the folder: "폴더 복원" (restore folder) and permanent delete.

### Step 13: "휴지통 · 폴더 안의 글 하나만 복원 → 폴더를 다시 만들고 원래 자리로"

- Board: `Flow5Step13.dc.html`
- Renders: `Trash` (stage "폴더에서 하나 복원")
- The user restores one post from inside a deleted folder. The folder is recreated, the post returns to its original place as a draft, and a notice says so with "열기" (open).

### Step 14: "휴지통 · 찾기 → 폴더 안에 든 것까지 · 경로가 보임"

- Board: `Flow5Step14.dc.html`
- Renders: `Trash` (stage "휴지통 찾기")
- Searching the trash also finds items inside deleted folders. The result row shows its path ("시리즈 원고 폴더 안 · KO") and days left. The words stay in the search box; there is no search chip.

### Step 15: "휴지통 · 어시스턴트가 버린 것은 ✦ 버림 · 누르면 그 대화 · 영구 삭제는 사람만"

- Board: `Flow5Step15.dc.html`
- Renders: `Trash` (stage "어시스턴트")
- Items deleted by the assistant carry a ✦ before their day in the date column (in the proposal blue). Clicking it opens that conversation. Permanent deletion is for people only; the assistant cannot do it.

### Step 16: "휴지통 · 행을 우클릭 → 복원 · 영구 삭제"

- Board: `Flow5Step16.dc.html`
- Renders: `Trash` (stage "행 메뉴")
- The user right-clicks a trash row. The menu offers restore and permanent delete (Del).

### Step 17: "휴지통 · 종류: 미디어 · 복원하면 원래 폴더로 · 30일 뒤 파일도 지움"

- Board: `Flow5Step17.dc.html`
- Renders: `Trash` (stage "미디어")
- The user filters the trash by kind "미디어" (media). The "종류" name gets its dot and only media rows show (a deleted folder with 3 files, an image). Restoring puts a file back in its original folder; after 30 days the file itself is deleted.

### Step 18: "휴지통 · 글을 열면 읽기 전용 · 복원 · 영구 삭제"

- Board: `Flow5Step18.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; todo-open off; trashed on)
- The user opens a trashed post. The editor is read-only, with a banner "휴지통에 있는 글이에요" saying that restoring brings it back as a draft (23 days left), and "복원" and "영구 삭제" in the header.

### Step 19: "휴지통 · 항목을 열면 옆 패널 · 가리키는 글 · 복원 · 영구 삭제"

- Board: `Flow5Step19.dc.html`
- Renders: `Trash` (stage "항목 열기")
- The user opens a trashed item, here a tag. A side panel shows it read-only: collection, name, address, deleted date, and the posts that point to it (4, with titles), plus restore and permanent delete.

### Step 20: "휴지통 · 미디어를 열면 옆 패널 · 미리보기 · 복원 · 영구 삭제"

- Board: `Flow5Step20.dc.html`
- Renders: `Trash` (stage "미디어 열기")
- The user opens a trashed media file. A side panel shows the preview, kind, size, folder, alt text, deleted date and where it was used (none), plus restore and permanent delete.

## "복원" · Restore

### Step 21: "복원 · 초안으로 돌아옴 · 열기"

- Board: `Flow5Step21.dc.html`
- Renders: `Trash` (stage "복원함")
- After a restore, a notice says the post is back as a draft, with "열기" (open).

### Step 22: "복원 · 번역만 복원하려는데 원문이 휴지통 → 원문 복원"

- Board: `Flow5Step22.dc.html`
- Renders: `Trash` (stage "번역 막힘")
- Exception: the user restores only a translation while its source post is in the trash. The row says the source is in the trash ("원문이 휴지통에 있어요", with its title) and the action reads "원문 복원" (restore the source) instead of "복원".

## "영구 삭제" · Permanent delete

### Step 23: "영구 삭제 · 확인 · 공개됐던 주소는 남겨 둠"

- Board: `Flow5Step23.dc.html`
- Renders: `Trash` (stage "삭제 확인")
- Permanent delete confirm. It says deleting cannot be undone, and that an address that was ever published (/about-old) stays reserved so no other post can use it. Buttons: cancel, delete.

### Step 24: "영구 삭제 · 가리키는 글이 있으면 막힘 → 연결 끊기 · 같이 삭제"

- Board: `Flow5Step24.dc.html`
- Renders: `Trash` (stage "삭제 막힘")
- Exception: permanent delete of an item that other posts point to is blocked. The dialog lists the posts that point to it (4 posts, with "외 3편" for the rest) and offers "연결 끊기" (cut the links, keeping the posts and removing the tag from their tag field) or "같이 삭제" (delete them too; 1 post in the trash is named).

## "여러 개" · Many items

### Step 25: "여러 개 · 골라서 복원 · 영구 삭제"

- Board: `Flow5Step25.dc.html`
- Renders: `Trash` (stage "선택")
- Selecting several trash rows. A bulk bar shows "2개 선택" with restore, permanent delete and clear selection.

## "비우기" · Empty the trash

### Step 26: "비우기 · 확인"

- Board: `Flow5Step26.dc.html`
- Renders: `Trash` (stage "비우기 확인")
- The user presses "비우기" (empty trash). A confirm says 9 items will be permanently deleted, that anything other posts point to is kept, and that the reason will be shown. Buttons: cancel, empty.

### Step 27: "비우기 · 막힌 것만 남고 이유가 보임"

- Board: `Flow5Step27.dc.html`
- Renders: `Trash` (stage "비운 뒤")
- After emptying, only the blocked items remain and each shows why (for example a tag pointed to by 4 posts). A notice says 6 were deleted and 1 was kept.

### Step 28: "빈 휴지통"

- Board: `Flow5Step28.dc.html`
- Renders: `Trash` (stage "빔")
- The trash is empty and the screen says "휴지통이 비었어요."

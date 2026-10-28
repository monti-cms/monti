# Flow 6: Media

This file lists every row and step of canvas flow 6, "흐름 6 · 미디어". Uploading, inserting from the editor, browsing, replacing a file, alt text, deleting, files that are not images, picking, and exceptions.

Canvas note: "흐름 6 · 미디어 — 올리기 · 편집기에서 넣기 · 둘러보기 · 파일 바꾸기 · 대체 텍스트 · 지우기 · 이미지가 아닌 파일 · 고르기 · 예외"

Screens used: [`Media`](../screens.md#media), [`EditorNotion`](../screens.md#editornotion), [`ImageInsert`](../screens.md#imageinsert).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "올리기" · Upload

### Step 01: "올리기 · 끌어 오면 지금 폴더에 테두리 · 아래 알약 "여기에 올려요""

- Board: `Flow6Step01.dc.html`
- Renders: `Media` (mode "끌어 놓기")
- The user drags files over the media library. The current folder gets a border and a pill at the bottom says "여기에 올려요" (uploading here).
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 02: "올리기 · 하위 폴더 위로 가면 그 폴더만 강조 · "covers에 올려요""

- Board: `Flow6Step02.dc.html`
- Renders: `Media` (mode "폴더 위로 끌기")
- The user drags over a sub-folder. Only that folder is highlighted and the pill names it ("covers에 올려요").
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 03: "올리기 · 올리는 중"

- Board: `Flow6Step03.dc.html`
- Renders: `Media` (mode "올리는 중")
- Uploading. Each file shows a thumbnail with progress ("올리는 중 · 64%") or "대기" (waiting).
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 04: "올리기 · 실패한 파일은 그 자리에 남음 · 줄여서 다시 · 빼기"

- Board: `Flow6Step04.dc.html`
- Renders: `Media` (mode "올리기 실패")
- Failed files stay in place with the reason: "올릴 수 없는 형식" (HEIC) with a remove action, or too large (14 MB, 10 MB limit) with "줄여서 다시" (shrink and retry) and remove.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "편집기에서 올리기" · Upload in the editor

### Step 05: "편집기 · 붙여넣거나 끌어 놓으면 커서 자리에 바로 · 올리는 중"

- Board: `Flow6Step05.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "올리는 중")
- In the editor the user pastes or drops an image. It lands at the cursor right away with an uploading state and a caption field.
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: upload in the editor (05–06))

### Step 06: "편집기 · 이미지를 누르면 설정 · 대체 텍스트 · 캡션 · ✦ 채우기"

- Board: `Flow6Step06.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "설정")
- The user clicks an image in the editor. A settings card opens: caption, width (body width), alt text with the hint to type one or mark the image as decorative, and the "✦ 채우기" (fill) action.
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: upload in the editor (05–06))

## "둘러보기" · Browse

### Step 07: "둘러보기 · 미디어 맨 위 · 폴더와 폴더에 넣지 않은 파일"

- Board: `Flow6Step07.dc.html`
- Renders: `Media` (mode "최상위")
- The library top level shows folders and files not placed in any folder, with a count of folders and files.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 08: "둘러보기 · 폴더 안 (Blog Assets) · 하위 폴더 · 파일"

- Board: `Flow6Step08.dc.html`
- Renders: `Media` (mode "폴더 안")
- Inside a folder (Blog Assets) the library shows its sub-folders and files.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 09: "둘러보기 · + 폴더 → 그 자리에 새 폴더 · 이름이 골라진 채로"

- Board: `Flow6Step09.dc.html`
- Renders: `Media` (mode "새 폴더")
- The user presses "+ 폴더". A new folder appears in place with its name selected.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 10: "둘러보기 · 폴더를 우클릭 → 열기 · 이름 바꾸기 · 옮기기 ▸ · 폴더 지우기"

- Board: `Flow6Step10.dc.html`
- Renders: `Media` (mode "폴더 우클릭")
- The user right-clicks a folder. The menu offers open, rename, move to ▸ and delete folder.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 13: "둘러보기 · 빈 곳을 우클릭 → 올리기 · 새 폴더"

- Board: `Flow6Step13.dc.html`
- Renders: `Media` (mode "빈 곳 우클릭")
- The user right-clicks empty space. The menu offers upload and new folder.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 14: "둘러보기 · 목록 보기 · 사용 · 형식 · 크기 · 치수 · 올린 날"

- Board: `Flow6Step14.dc.html`
- Renders: `Media` (mode "목록 보기")
- List view. Columns: name, use (number of posts using it, or unused), type, size, dimensions, uploaded date.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 15: "둘러보기 · 검색 → 찾는 곳을 모든 폴더로 넓힘 · 경로가 보임"

- Board: `Flow6Step15.dc.html`
- Renders: `Media` (mode "찾는 중")
- The user searches. The search scope widens to all folders and each result shows its folder path, use count or unused.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 16: "둘러보기 · 파일 열기 → 옆 패널 · 쓰는 곳"

- Board: `Flow6Step16.dc.html`
- Renders: `Media` (mode "파일 열기")
- The user opens a file. A side panel shows copy address, open in new tab, file name, folder, default alt text (with a fill action), default caption, type, size (web 2400×1600, original 4032×2688), uploaded date, and where it is used.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 17: "둘러보기 · 파일을 우클릭 → 열기 · 쓰는 곳 ▸ · 폴더로 ▸"

- Board: `Flow6Step17.dc.html`
- Renders: `Media` (mode "파일 메뉴")
- The user right-clicks a file. The menu offers open, "쓰는 곳 ▸" (used in: the posts and where, for example cover image or body), and move to folder ▸.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "폴더 지우기" · Delete a folder

### Step 11: "지우기 · 폴더 지우기 → 확인 없이 폴더째 휴지통으로 · 되돌리기"

- Board: `Flow6Step11.dc.html`
- Renders: `Media` (mode "폴더 지움")
- Deleting a folder: no confirm. The folder goes to the trash with its files; a notice says so with "되돌리기".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 12: "지우기 · 쓰는 파일이 있는 폴더 → 그 파일만 폴더째 남김 · 보기"

- Board: `Flow6Step12.dc.html`
- Renders: `Media` (mode "폴더 일부 남김")
- Deleting a folder that holds files in use: only the files not in use move; the folder stays with the files that are used. A notice says 2 moved and 4 stayed because they are used, with "보기" (view).
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "파일 바꾸기" · Replace a file

### Step 18: "고치기 · 옆 패널 ⋯ → 파일 바꾸기 → 파일 고르기"

- Board: `Flow6Step18.dc.html`
- Renders: `Media` (mode "바꾸기 메뉴")
- In the side panel the user opens ⋯: replace file, copy ID, move to trash (copy address and open in new tab are in the panel body, under the picture). They choose "파일 바꾸기" and pick a file.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 19: "고치기 · 고른 파일 확인 → 쓰는 곳 2곳이 새 파일로"

- Board: `Flow6Step19.dc.html`
- Renders: `Media` (mode "파일 바꾸기")
- The user confirms the chosen file. The side panel states that the 2 places using the old file will use the new file.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "여러 개 옮기기" · Move many

### Step 20: "고치기 · 여러 개 선택"

- Board: `Flow6Step20.dc.html`
- Renders: `Media` (mode "여러 개 선택")
- The user selects several files. A bulk bar shows the count with move to folder, trash and clear selection.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 21: "고치기 · 폴더로 옮기기"

- Board: `Flow6Step21.dc.html`
- Renders: `Media` (mode "폴더로 옮기기")
- The user opens "폴더로" (to folder) in the bulk bar. A menu lists top level, the folders and "+ 새 폴더".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "대체 텍스트 채우기" · Fill alt text

### Step 22: "대체 텍스트 · 필터 열기 → 없음 · 있음 (지금 폴더와 하위 폴더)"

- Board: `Flow6Step22.dc.html`
- Renders: `Media` (mode "필터 열기")
- The user opens the filter. Alt text: none | present, applied to the current folder and its sub-folders, with a count.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 23: "대체 텍스트 · 없음 → 칩 “대체 텍스트: 없음 ×” · 찾는 곳 Blog Assets | 모든 폴더"

- Board: `Flow6Step23.dc.html`
- Renders: `Media` (mode "필터 걸림")
- The user picks "없음" (none). A chip "대체 텍스트: 없음 ×" appears, and the search scope reads "Blog Assets | 모든 폴더".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 24: "대체 텍스트 · 없는 것 모두 선택"

- Board: `Flow6Step24.dc.html`
- Renders: `Media` (mode "대체 텍스트 없는 것 고름")
- The user selects every file without alt text. The bulk bar shows "3개 선택".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 25: "대체 텍스트 · ✦ 대체 텍스트 → 파란 제안 3 · 모두 버리기 · 모두 받기"

- Board: `Flow6Step25.dc.html`
- Renders: `Media` (mode "대체 텍스트 제안")
- The user presses "✦ 대체 텍스트". Blue proposals appear on the 3 files ("제안 3") with "모두 버리기" (discard all) and "모두 받기" (accept all).

### Step 26: "대체 텍스트 · 제안 하나를 눌러 메모 → 그 자리에서 다시 고침 · 버리기 · 받기"

- Board: `Flow6Step26.dc.html`
- Renders: `Media` (mode "대체 텍스트 메모")
- The user clicks a proposal to add a memo. The assistant rewrites it in place; each proposal can be discarded or accepted.

## "파일 지우기" · Delete a file

### Step 27: "지우기 · 휴지통으로 → 되돌리기"

- Board: `Flow6Step27.dc.html`
- Renders: `Media` (mode "휴지통으로 옮김")
- Deleting a file moves it to the trash. A notice says so with "되돌리기".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 28: "지우기 · 쓰는 곳이 있는 파일은 남김"

- Board: `Flow6Step28.dc.html`
- Renders: `Media` (mode "일부 남김")
- A file in use is not moved. A notice says 1 was moved and 1 was kept because it is used, with "보기".
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "편집기에서 고르기" · Pick in the editor

### Step 29: "고르기 · 편집기 / → 이미지 → 라이브러리 · 고르면 바로 들어감"

- Board: `Flow6Step29.dc.html`
- Renders: `ImageInsert` (stage "라이브러리")
- In the editor the user types `/` and picks Image › Library. The library opens; choosing an image inserts it at once.
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: pick in the editor (29–30))

### Step 30: "고르기 · 대표 이미지 칸"

- Board: `Flow6Step30.dc.html`
- Renders: `ImageInsert` (stage "대표 이미지")
- The user opens the cover image field. The same library opens and shows the "고르기" (pick) action.
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: pick in the editor (29–30))

## "종류로 거르기" · Filter by kind

### Step 32: "거르기 · 종류 ▾ → 이미지 · 파일"

- Board: `Flow6Step32.dc.html`
- Renders: `Media` (mode "종류 열기")
- The user opens the type filter. Choices: images (count) and files.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 33: "거르기 · 종류: 파일 → 파일만 · 대체 텍스트 거르기가 빠짐"

- Board: `Flow6Step33.dc.html`
- Renders: `Media` (mode "종류 파일")
- The user picks files. The list shows files only, the chip "종류: 파일" appears, and the alt text filter is gone because it does not apply.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "PDF 같은 파일" · Files such as PDF

### Step 34: "파일 · PDF 올리기 → 미리보기 대신 파일 아이콘 · PDF · 이름 · 이미지와 같은 올리는 중"

- Board: `Flow6Step34.dc.html`
- Renders: `Media` (mode "PDF 올리는 중")
- The user uploads a PDF or other file. Instead of a preview the tile shows a file icon with the type (PDF, CSV) and the name; the uploading state is the same as for images.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 35: "파일 · 받지 않는 형식(.exe) → 그 자리에 남고 받는 종류 한 줄 · 빼기"

- Board: `Flow6Step35.dc.html`
- Renders: `Media` (mode "받지 않는 형식")
- Exception: a type that is not accepted (.exe). The file stays in place with one line listing the accepted kinds (images, PDF, ZIP, text only) and a remove action.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 36: "파일 · 파일 열기 → 옆 패널 · 이름 · 종류 · 크기 · 쓰는 곳 · 주소 복사 · 파일 바꾸기 · 휴지통으로 (대체 텍스트 없음)"

- Board: `Flow6Step36.dc.html`
- Renders: `Media` (mode "PDF 열기")
- The user opens a PDF. The side panel shows name, type, size, uploaded date, where used, copy address, replace file, move to trash; there is no alt text.
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### Step 37: "파일 · 편집기 / 파일 → 파일만 보이는 라이브러리"

- Board: `Flow6Step37.dc.html`
- Renders: `ImageInsert` (stage "파일")
- In the editor the user types `/` › File. The library opens showing files only (PDF, CSV, ZIP, MD) with a type filter.
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: files such as PDF (37–38))

### Step 38: "파일 · 고르면 본문에 파일 블록 · 아이콘 · 이름 · PDF · 크기"

- Board: `Flow6Step38.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "파일")
- After picking, the body gets a file block with an icon, the name, the type and the size (price-list-2026.pdf, PDF, 1.2 MB).
- Test: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: files such as PDF (37–38))

## "예외" · Exceptions

### Step 31: "예외 · 저장소가 없음"

- Board: `Flow6Step31.dc.html`
- Renders: `Media` (mode "저장소 없음")
- Exception: the site has no media storage. The screen says "미디어 저장소가 없어요" (no media storage), that uploading needs storage, and offers "연결 방법" (how to connect).
- Test: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

# Flow 9: Data

This file lists every row and step of canvas flow 9, "흐름 9 · 데이터". Downloading a backup and importing (read the file, then either new posts or a restore).

Canvas note: "흐름 9 · 데이터 — 백업 받기 · 가져오기(파일을 보고 새 글 또는 복원)"

Screens used: [`Data`](../screens.md#data), [`Main`](../screens.md#main), [`Events`](../screens.md#events).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "백업" · Backup

### Step 01: "백업 · 도구 › 데이터 · 백업 받기 · 마지막 백업 · 미디어 파일도 담기(기본 꺼짐)"

- Board: `Flow9Step01.dc.html`
- Renders: `Data` (stage "기본")
- Tools › Data. The backup section shows "백업 받기" (download backup), the date of the last backup, and the option "미디어 파일도 담기" (include media files, 2.1 GB), off by default. Below it is the import section with a zip drop area.

### Step 02: "백업 · 고를 것 없이 바로 · 버튼에 진행"

- Board: `Flow9Step02.dc.html`
- Renders: `Data` (stage "백업 중")
- The user presses the backup button. There is nothing to choose first. The button shows progress ("만드는 중 64%").

### Step 03: "백업 · 저장했어요 · 마지막 백업이 오늘로"

- Board: `Flow9Step03.dc.html`
- Renders: `Data` (stage "백업 받음")
- The backup is saved. A notice says so and the last-backup date changes to today.

### Step 04: "백업 · 목록에서 고른 글만 → ⋯ → 내보내기"

- Board: `Flow9Step04.dc.html`
- Renders: `Main` (mode "고른 글 내보냄")
- A partial export. In the post list the user selects posts and uses ⋯ › export. A notice says "2편을 내보냈어요" (2 posts exported).

## "가져오기" · Import

### Step 05: "가져오기 · zip을 놓거나 고름 → 읽는 중 (빈 목록의 쓰던 글 가져오기도 여기로)"

- Board: `Flow9Step05.dc.html`
- Renders: `Data` (stage "읽는 중")
- The user drops or picks a zip file. The import area shows "읽는 중…" (reading). The empty post list's "import posts you already wrote" action also leads here.

### Step 06: "가져오기 · 본문이 같으면 건너뛰고 주소가 겹치면 -2 (한 줄 안내) · 들어갈 곳 · 필드 맞추기"

- Board: `Flow9Step06.dc.html`
- Renders: `Data` (stage "가져오기")
- The file was read. A summary says 24 posts were found, that posts with identical body are skipped and posts with an overlapping address get -2 added (one line). The user sets the destination (folder posts/ into the "게시글" collection, 24 posts) and maps the file's front matter to fields: title → "제목", date → "발행일", tags → "태그" (with the note "새 태그 4개가 생겨요", 4 new tags will be created), description → "요약", thumbnail → "대표 이미지", layout → not imported.

### Step 07: "가져오기 · 발행은 모두 초안 · 이미지는 미디어로 · 모르는 컴포넌트 · 빈 필수 필드"

- Board: `Flow9Step07.dc.html`
- Renders: `Data` (stage "가져오기 아래")
- Below the field mapping: publish status ("모두 초안", all drafts, with a way to restore the original), images (38 images go to the media folder "가져온 이미지"; option to also move 6 outside images), and a notes block: 3 component kinds left as original text (Callout, Tweet, Chart in 12 posts), and 18 posts without a summary that must be filled before publishing. The button reads "21편 가져오기" (import 21).

### Step 08: "가져오기 · 가져오는 중"

- Board: `Flow9Step08.dc.html`
- Renders: `Data` (stage "가져오는 중")
- The user presses import. The same sheet shows the importing state.

### Step 09: "가져오기 · 결과 · 주소를 바꾼 글 목록(누르면 편집기) · 통째로 되돌리기 · 목록에서 보기"

- Board: `Flow9Step09.dc.html`
- Renders: `Data` (stage "가져옴")
- Result: "21편을 가져왔어요." with the summary (all drafts, 4 new tags, 38 images) and the list of posts whose address changed (2, each shown as old → new; clicking one opens the editor). Actions: undo the whole import ("되돌리기") and "목록에서 보기" (view in the list).

### Step 10: "가져오기 · 시트를 닫은 뒤에도 · 활동 기록의 가져오기 줄 → 옆 판에 그때 결과 · 되돌리기"

- Board: `Flow9Step10.dc.html`
- Renders: `Events` (default stage "기본"; with-import on; import-detail on)
- After the sheet is closed. In the activity log the import line (11:05, blog-export.zip) opens a side panel with the result from that time (same summary and changed-address list) and an undo action.

### Step 11: "가져오기 · 읽지 못한 파일"

- Board: `Flow9Step11.dc.html`
- Renders: `Data` (stage "못 읽음")
- Exception: the file could not be read. The import area says "읽지 못했어요" (could not read it).

## "복원" · Restore

### Step 12: "복원 · 빈 사이트에 전체 백업 → 있던 그대로 복원 (글이 있으면 새 글로 가져오기)"

- Board: `Flow9Step12.dc.html`
- Renders: `Data` (stage "복원")
- Restore on an empty site with a full backup. The file summary (monti-backup-1020.zip: drafts 12, published 130, archived 6, translations 21; folders 3; media 24 with files; addresses 160 plus 12 old; templates 3) heads a "있던 그대로 복원" (restore as it was) action. If the site already has posts, the same file is imported as new posts instead.

### Step 13: "복원 · 문제가 있으면 하나도 쓰지 않음"

- Board: `Flow9Step13.dc.html`
- Renders: `Data` (stage "복원 막힘")
- Exception: problems found. Nothing is written. The panel says "문제가 2개 있어서 복원하지 않아요." and lists them: a field the site does not have (series, 14 posts carry it) and an overlapping address (/about, two posts use the same one).

### Step 14: "복원 · 복원하는 중"

- Board: `Flow9Step14.dc.html`
- Renders: `Data` (stage "복원 중")
- Restoring. The button shows "복원하는 중…".

### Step 15: "복원 · 다 됨 · 목록 보기"

- Board: `Flow9Step15.dc.html`
- Renders: `Data` (stage "복원함")
- Done: "글 148편을 복원했어요" with "목록 보기" (view the list).

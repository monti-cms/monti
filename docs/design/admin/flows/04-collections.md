# Flow 4: Collections

This file lists every row and step of canvas flow 4, "흐름 4 · 컬렉션". Creating a collection, editing its fields, changing its public address and deleting it, on a dev server.

Canvas note: "흐름 4 · 컬렉션 — 새 컬렉션 · 필드 고치기 · 주소 바꾸기 · 컬렉션 지우기 (개발 서버)"

Screens used: [`Schema`](../screens.md#schema).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "새 컬렉션" · New collection

### Step 01: "새 컬렉션 · 이름 · 식별자 · 종류 · 공개 주소(앞부분만) → 만들기"

- Board: `Flow4Step01.dc.html`
- Renders: `Schema` (stage "새 컬렉션")
- In Settings › Collections the user starts a new collection. A form asks for name, identifier, kind (document: has a body, like posts and notes; item: short, like categories and tags) and the public address (only the front part, ending in /:slug). The user presses "만들기" (create).

### Step 02: "새 컬렉션 · 오류 · 이미 쓰는 식별자"

- Board: `Flow4Step02.dc.html`
- Renders: `Schema` (stage "새 컬렉션 오류")
- Error: the identifier is already used. The identifier field shows "이미 쓰는 이름이에요." and the form stays open.

### Step 03: "새 컬렉션 · title · slug 두 필드로 시작 · 아직 저장 전"

- Board: `Flow4Step03.dc.html`
- Renders: `Schema` (stage "만든 직후")
- The collection exists in the sidebar's settings list with two fields, title and slug. It is not saved yet.

### Step 04: "새 컬렉션 · + 필드 추가"

- Board: `Flow4Step04.dc.html`
- Renders: `Schema` (stage "노트 필드 추가"; sheet-kind "글자")
- The user adds a field. The field sheet "필드 추가" opens for the new collection (kinds: text, choice, relation, advanced) with display name, name, help text, multiline, max length and rows.

### Step 05: "새 컬렉션 · 저장하고 적용 → 검토 · 데이터는 그대로"

- Board: `Flow4Step05.dc.html`
- Renders: `Schema` (stage "새 컬렉션 검토")
- The user presses "저장하고 적용" (save and apply). A review lists the change (new collection, public address /notes/:slug, fields title and slug) and says "저장된 데이터는 바뀌지 않아요." (stored data is not changed). The user presses "적용".

### Step 06: "새 컬렉션 · 적용 → 사이드바에 노트"

- Board: `Flow4Step06.dc.html`
- Renders: `Schema` (stage "만듦")
- Applied. A notice says the collection "노트" was created, with a "보기" (view) action, and it is in the sidebar.

## "필드 고치기" · Edit fields

### Step 07: "필드 고치기 · 이름 바꿈 · 지움 · 새 필수 → 바뀐 곳 3"

- Board: `Flow4Step07.dc.html`
- Renders: `Schema` (stage "필드 바꿈")
- The user edits fields: one renamed (summary → excerpt), one removed (subtitle), one new required field ("글 종류", select). The field list marks each change and the header counts 3 changes.

### Step 08: "필드 고치기 · 속성 패널 미리보기 → 글 편집기에서 보일 모습 (저장 안 됨)"

- Board: `Flow4Step08.dc.html`
- Renders: `Schema` (stage "미리보기")
- The property panel preview shows how the fields will look in the post editor ("저장 안 됨", not saved), for example the new required "글 종류" with its placeholder.

### Step 09: "필드 고치기 · 고칠 곳이 있으면 미리보기 대신 고칠 곳 목록 · 저장하고 적용 막힘"

- Board: `Flow4Step09.dc.html`
- Renders: `Schema` (stage "미리보기 오류")
- When a field has a problem (the select has no options), the preview is replaced by a list of what to fix ("고칠 곳이 있어 미리볼 수 없어요", "선택지가 없어요"). Save and apply is blocked.

### Step 10: "필드 고치기 · 바뀐 곳 ▾ → 하나씩 되돌리기"

- Board: `Flow4Step10.dc.html`
- Renders: `Schema` (stage "바뀐 곳 목록")
- The user opens the "바뀐 곳 ▾" (changes) list. Each change can be undone one by one with "되돌리기".

### Step 11: "필드 고치기 · 검토 · 바꾼 것마다 값 처리 고르기"

- Board: `Flow4Step11.dc.html`
- Renders: `Schema` (stage "필드 검토")
- Review. For each change the user chooses what happens to the values. The rename "summary → excerpt": move the values (148 posts) or start with empty cells. The removed "subtitle": keep the values (132 posts), move them to another field, or delete them (values stay in the posts but are hidden on the site). The new required "글 종류": fill the 148 empty posts, or leave them (they cannot be published until filled). The affected posts are listed.

### Step 12: "필드 고치기 · 값 지우기를 고르면 빨간 “지우고 적용”"

- Board: `Flow4Step12.dc.html`
- Renders: `Schema` (stage "값 지우기")
- If the user chooses to delete the values, the apply button turns red and reads "지우고 적용" (delete and apply).

## "주소 바꾸기" · Change the address

### Step 13: "주소 바꾸기 · 공개 주소 고침"

- Board: `Flow4Step13.dc.html`
- Renders: `Schema` (stage "주소 바꿈")
- The user changes the collection's public address on its basic tab.

### Step 14: "주소 바꾸기 · 검토 · 발행된 글 148편"

- Board: `Flow4Step14.dc.html`
- Renders: `Schema` (stage "주소 검토")
- Review for the address change. Before and after are shown (/posts/:slug → /blog/:slug). The review says 148 published posts change address and the old addresses become 404.

## "컬렉션 지우기" · Delete a collection

### Step 15: "컬렉션 지우기 · 기본 탭 맨 아래 “지우기”"

- Board: `Flow4Step15.dc.html`
- Renders: `Schema` (stage "지우기 전")
- On the collection's basic tab, the bottom has a "지우기" (delete) action with a count (23 posts, 2 of them in the trash).

### Step 16: "컬렉션 지우기 · 저장 전까진 줄 그은 채 · 되돌리기"

- Board: `Flow4Step16.dc.html`
- Renders: `Schema` (stage "지울 예정")
- After the user presses delete, the collection stays in the list struck through until saved, with "되돌리기" (undo).

### Step 17: "컬렉션 지우기 · 검토 · 가리키는 글이 있으면 막힘 → 연결 끊기"

- Board: `Flow4Step17.dc.html`
- Renders: `Schema` (stage "지우기 검토")
- Review for the deletion of the collection "메모": 23 posts (2 in the trash) are permanently deleted, with 2 folders and 31 old addresses. If other content points to it (4 posts, for example "첫 번째 글" and 3 more, and 2 body links that would show as broken links), deleting is blocked until the user cuts the links with "연결 끊기". There is an export action. A field asks for the identifier.

### Step 18: "컬렉션 지우기 · 식별자 입력 → 지우고 적용"

- Board: `Flow4Step18.dc.html`
- Renders: `Schema` (stage "지우기 확인")
- The user types the identifier ("memo") into the confirm field. The text says this cannot be undone and that a production site deletes it on deploy. The apply button reads "지우고 적용".

### Step 19: "컬렉션 지우기 · 지운 뒤"

- Board: `Flow4Step19.dc.html`
- Renders: `Schema` (stage "지운 뒤")
- After deleting, a notice says "메모를 지웠어요 · 글 23편" and the collection is gone from the settings list.

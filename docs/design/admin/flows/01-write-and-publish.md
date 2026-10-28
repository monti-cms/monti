# Flow 1: Write and publish

This file lists every row and step of canvas flow 1, "흐름 1 · 글 쓰고 발행하기". Writing a post from the first slash to publishing and editing after publishing, with two exceptions: an edit conflict and recovering a browser draft.

Canvas note: "흐름 1 · 글 쓰고 발행하기 — 새 글부터 발행 후 고치기까지, 예외 둘(편집 충돌, 임시 저장본 복구)"

Screens used: [`Main`](../screens.md#main), [`EditorNotion`](../screens.md#editornotion), [`EditorCompare`](../screens.md#editorcompare).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "글 쓰고 발행하기" · Write and publish

### Step 01: "게시글 목록에서 새 글 쓰기"

- Board: `Flow1Step01.dc.html`
- Renders: `Main` (default mode "처음 화면")
- The user is on the post list and starts a new post with the new-post button. The screen is the default post list.

### Step 02: "새 글 · / 로 템플릿 고르기"

- Board: `Flow1Step02.dc.html`
- Renders: `EditorNotion` (doc "새 글"; state "템플릿 고르기"; pub "초안"; todo-open off)
- A new post opens with an empty title (0 characters, not yet saved). The user types `/` and the template list opens in place: "기본 글" (intro, body, conclusion), "책 리뷰" (one-line review, plot, quote, thoughts) and "튜토리얼" (needs, steps, code, wrap-up). The footer says the address is made from the title when the post is published.

### Step 03: "쓰기 · 블록 손잡이와 서식 카드"

- Board: `Flow1Step03.dc.html`
- Renders: `EditorNotion` (default state "글자 고름 + 블록 메뉴"; pub "초안"; todo-open off)
- The user selects text. The format card (bold, italic, underline, strike, code, link, ✦ request) appears over it, and the block handle menu is open: turn into another block, align, move up (⌥↑), move down (⌥↓), duplicate (⇧⌘D), delete (⇧⌘⌫). The status shows unsaved changes.

### Step 04: "쓰기 · 손잡이 → 다른 블록으로 바꾸기"

- Board: `Flow1Step04.dc.html`
- Renders: `EditorNotion` (state "블록 바꾸기"; pub "초안"; todo-open off)
- From the block handle menu the user opens "turn into another block". A submenu lists the block types (heading 2, 3, 4, lists and so on).

### Step 05: "쓰기 · 손잡이 → 정렬"

- Board: `Flow1Step05.dc.html`
- Renders: `EditorNotion` (state "블록 정렬"; pub "초안"; todo-open off)
- From the block handle menu the user opens "align". A submenu offers left, center and right.

### Step 06: "쓰기 · 하단 플러그인 칸 → 판에서 하나씩 고치기"

- Board: `Flow1Step06.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; todo-open off; plugin-open on)
- The user opens the plugin strip at the bottom of the editor (spelling check). It lists findings one by one, for example "몇일 → 며칠" and "안되요 → 안 돼요", each with a fix button, plus a settings link and "모두 고치기" (fix all). The user fixes them one at a time in the panel.

### Step 07: "속성 정하기 · 기본"

- Board: `Flow1Step07.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; series-pending on; todo-open off)
- The user sets the post properties, basic tab. The series field is mid-choice and offers the series "리액트 다시 만들기".

### Step 08: "속성 정하기 · SEO"

- Board: `Flow1Step08.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; panel-tab "SEO"; todo-open off)
- The user switches the property panel to the SEO tab: SEO title ("same as title", 10/60), SEO description ("same as summary"), share image ("same as cover") and hide from search ("no").

### Step 09: "저장 ⌘S · 서버에 저장됨"

- Board: `Flow1Step09.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo-open off)
- The user saves with ⌘S. The status bar changes from unsaved changes to saved on the server.

### Step 10: "발행하기 → 막힘 · 할 일 2"

- Board: `Flow1Step10.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; toast "발행 막힘"; todo-open on)
- The user presses publish while required fields are still empty. Publishing is blocked, a toast says to fix the 2 to-dos first, and the to-do panel opens with two items: write the summary (empty) and add alt text to 2 images (cover image, body image 1).

### Step 11: "할 일 1 · 요약 쓰기"

- Board: `Flow1Step11.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; fix "요약"; todo-open off)
- To-do 1. The user writes the summary in the property panel; the counter shows 28 of 120 characters.

### Step 12: "할 일 2 · 이미지 대체 텍스트"

- Board: `Flow1Step12.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; fix "대체 텍스트"; todo-open off)
- To-do 2. The user writes alt text for an image (23 of 80 characters) and moves on with "next image".

### Step 13: "할 일 다 채움 → 발행하기 (저장도 같이)"

- Board: `Flow1Step13.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "다 채움"; todo-open on)
- All to-dos are filled and the panel reads "할 일 없음" (nothing to do), listing what was checked: image alt text, title, address, cover image. The user presses publish, which also saves the post.

### Step 14: "발행됨"

- Board: `Flow1Step14.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; toast "발행됨"; todo-open off)
- The post is published. The status reads published and a toast says "발행되었어요" with a "보기" (view) action.

### Step 15: "발행 후 고침 → 수정 중 · 다시 발행"

- Board: `Flow1Step15.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "저장됨"; todo "다 채움"; pub-menu on; todo-open off)
- The user edits after publishing. The status becomes "수정 중" (editing) and the publish menu offers two choices: republish keeping the original date ("발행일 2026. 10. 01 그대로") or republish with today's date ("오늘 날짜로 다시 발행", 2026. 10. 26).

## "다른 곳에서 먼저 저장" · Saved elsewhere first

### Step 16: "예외 · 다른 곳에서 먼저 저장 → 알림 줄"

- Board: `Flow1Step16.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "편집 충돌"; todo "다 채움"; dialog "편집 충돌"; todo-open off)
- Exception: the post was saved elsewhere first. A notice bar says it was saved at 10:41 from another place and this post cannot be saved, with "비교하기" (compare) and "서버 최신본 불러오기" (load the server version). The status reads edit conflict.

### Step 17: "비교하기 → 양쪽 글을 보고 한쪽 고르기"

- Board: `Flow1Step17.dc.html`
- Renders: `EditorCompare` (mode "편집 충돌")
- The user opens compare. The two versions sit side by side: the user's input (not saved) and the latest server version (v4, saved 10:41). The user picks one: load the server version, or save their own input.

## "다시 열었을 때 임시 저장본" · Browser draft on reopening

### Step 18: "예외 · 다시 열었을 때 임시 저장본 → 알림 줄"

- Board: `Flow1Step18.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "브라우저에만 임시 저장됨"; todo "다 채움"; dialog "임시 저장본 복구"; todo-open off)
- Exception: the user reopens a post that has unsaved edits kept only in this browser. A notice bar says so (10. 26 10:12) with "비교하기", "불러오기" (load) and "버리기" (discard). The status reads saved only in the browser.

### Step 19: "비교하기 → 양쪽 글을 보고 한쪽 고르기"

- Board: `Flow1Step19.dc.html`
- Renders: `EditorCompare` (mode "임시 저장본")
- The user opens compare for the browser draft. The browser draft (10. 26 10:12) sits beside the server copy (10. 26 09:58). The user picks one: load the draft, or discard it.

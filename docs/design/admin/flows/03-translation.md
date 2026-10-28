# Flow 3: Translation

This file lists every row and step of canvas flow 3, "흐름 3 · 번역". Creating and publishing a translation, handling a changed source, the language column in the list, translating many posts, and exceptions.

Canvas note: "흐름 3 · 번역 — 새 번역 · 발행 · 원문 바뀜 · 목록 · 여러 글 · 예외"

Screens used: [`EditorNotion`](../screens.md#editornotion), [`EditorTranslate`](../screens.md#editortranslate), [`TranslatePaired`](../screens.md#translatepaired), [`Main`](../screens.md#main), [`ProposalReview`](../screens.md#proposalreview).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "새 번역 · 발행" · New translation, publish

### Step 01: "새 번역 · “+ 언어” → 번역할 언어 고르기"

- Board: `Flow3Step01.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; todo-open off; lang-menu "열림")
- On a published post the user clicks "+ 언어" in the language tabs. A menu "번역 추가" (add translation) lists the languages to translate to (English, 日本語) and a link to manage languages.

### Step 02: "새 번역 · 흐린 원문으로 시작 · 주소는 원문 것을 복사"

- Board: `Flow3Step02.dc.html`
- Renders: `EditorTranslate` (stage "새 번역")
- A new translation opens. Every block starts dimmed (the source text shown faintly), the address is copied from the source post, and one to-do is open. The character count is 0.

### Step 03: "새 번역 · ✦ 번역 → 파란 제안 → 받기"

- Board: `Flow3Step03.dc.html`
- Renders: `EditorTranslate` (stage "번역 제안")
- The user presses ✦ translate. The translation arrives as blue proposals (6 proposals); the user accepts them one at a time or with "모두 받기" (accept all) or "모두 버리기" (discard all).

### Step 04: "새 번역 · 흐린 블록 → 번역 · 원문 유지 · 지우기"

- Board: `Flow3Step04.dc.html`
- Renders: `EditorTranslate` (stage "블록 고르기")
- For a block that is still dimmed, the user picks what to do with it: translate it, keep the source ("원문 유지") or delete it ("지우기").

### Step 05: "새 번역 · 원문 나란히 보기"

- Board: `Flow3Step05.dc.html`
- Renders: `TranslatePaired`
- The user views the source beside the translation. The screen splits into source ("한국어", last edited 10. 26) and translation (English, last edited 09. 20) with matching blocks side by side and a "원문 바뀜" marker where the source changed.

### Step 06: "발행 · 흐린 블록이 남으면 막힘 → 이동 (블록마다 정함)"

- Board: `Flow3Step06.dc.html`
- Renders: `EditorTranslate` (stage "발행 막힘")
- The user publishes while dimmed blocks remain. Publishing is blocked; the to-do panel lists "흐린 블록 1" (a dimmed block) and the title and address checks, and a "이동" (go) action jumps to the block. Each such block has to be decided on its own.

### Step 07: "발행됨 · /en/first-post"

- Board: `Flow3Step07.dc.html`
- Renders: `EditorTranslate` (stage "발행됨")
- The translation is published. A toast says it was published with a "보기" action; the address is /en/first-post.

## "원문 바뀜" · Source changed

### Step 08: "원문 바뀜 · 원문을 고쳐 다시 발행 → English 탭에 점"

- Board: `Flow3Step08.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; todo-open off; toast "발행됨")
- The source post is edited and republished. The English tab now shows a dot, meaning the source changed since the translation.

### Step 09: "원문 바뀜 · 번역을 열면 바뀐 곳마다 여백 표시 (바뀜 · 새로 · 지워짐)"

- Board: `Flow3Step09.dc.html`
- Renders: `EditorTranslate` (stage "원문 바뀜")
- The user opens the translation. Each changed place has a margin mark: changed ("바뀜"), new ("새로") or removed ("지워짐"). A banner says the source changed on 10. 26 in 3 places, with "모두 확인" (confirm all) and a count "원문 바뀜 3".

### Step 10: "원문 바뀜 · 표시를 누르면 원문 전후 → 확인 · ✦ 다시 번역"

- Board: `Flow3Step10.dc.html`
- Renders: `EditorTranslate` (stage "바뀜 카드")
- The user clicks a margin mark. A card shows the source before and after, with "확인" (confirm) and "✦ 다시 번역" (translate again).

### Step 11: "원문 바뀜 · ✦ 다시 번역 → 파란 제안 → 받기 → 다시 발행"

- Board: `Flow3Step11.dc.html`
- Renders: `EditorTranslate` (stage "다시 번역")
- The user presses ✦ translate again. The new translation of that block arrives as a blue proposal; the user accepts it and publishes again (the status reads editing until then).

## "목록 · 여러 글" · List, many posts

### Step 12: "목록 · 언어 이름 → 번역 · 원문 바뀜"

- Board: `Flow3Step12.dc.html`
- Renders: `Main` (mode "언어 메뉴")
- In the post list the user opens the language column menu. It lists languages with post counts (KO 148, EN 40, JA 6) and a translation filter: no translation (41), source changed (3), up to date (104). Choosing "원문 바뀜" adds the chip "번역: 원문 바뀜".

### Step 13: "여러 글 · 번역 상세 보기 → 글마다 원문 | 번역"

- Board: `Flow3Step13.dc.html`
- Renders: `ProposalReview` (default stage "검토"; kind "번역")
- For several posts, the translation proposal review shows details per post: the original and the translation side by side. The header reads "3편 적용" for the request "이 세 편 영어로 번역해 줘.", with "새 글 3편 · 되돌릴 수 있음" (3 new posts, can be undone), "모두 펼치기" (expand all) and per-post block counts (for example blocks 8, source kept 1).

## "예외" · Exceptions

### Step 14: "예외 · 언어가 하나뿐 → 설정에서 언어 추가"

- Board: `Flow3Step14.dc.html`
- Renders: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; todo-open off; lang-menu "언어 하나뿐")
- Exception: the site has only one language. The language menu shows "언어 추가" (add a language) with a link to settings.

### Step 15: "예외 · 이 번역만 휴지통으로 (원문은 그대로)"

- Board: `Flow3Step15.dc.html`
- Renders: `EditorTranslate` (stage "번역 지우기")
- Exception: the user moves only this translation to the trash from ⋯. The menu item "이 번역 휴지통으로" notes that the Korean source stays as it is.

# Flow 7: List tidy-up

This file lists every row and step of canvas flow 7, "흐름 7 · 목록 정리". Sorting by the column name menu, filtering, columns, per page, search scope, changing many posts and merging tags. Search and translation filters are covered in flows 2, 3, 5 and 6.

Canvas note: "흐름 7 · 목록 정리 — 열 이름 메뉴로 정렬 · 거르기 · 열 · 쪽마다 · 찾을 곳 · 여러 글 바꾸기 · 태그 합치기 (찾기 · 번역 거르기는 흐름 2 · 3 · 5 · 6에)"

Screens used: [`Main`](../screens.md#main), [`Taxonomy`](../screens.md#taxonomy).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "정렬" · Sort

### Step 01: "정렬 · 제목 이름을 누르면 그 열의 메뉴 · 오름차순 · 내림차순"

- Board: `Flow7Step01.dc.html`
- Renders: `Main` (mode "제목 메뉴")
- The user clicks a column name (title). The column's menu opens: ascending, descending.

### Step 01b: "정렬 · 오름차순을 고르면 메뉴가 닫히고 제목 이름이 잉크색으로 ↑"

- Board: `Flow7Step01b.dc.html`
- Renders: `Main` (mode "제목 오름차순")
- The user picks ascending. The menu closes and the title name turns ink-colored with an up arrow.

## "열과 쪽" · Columns and page size

### Step 02: "열 · ⋯ 위의 + → 숨긴 열만 나와요 · 고르면 그 열이 생겨요"

- Board: `Flow7Step02.dc.html`
- Renders: `Main` (mode "열 추가")
- The user clicks the + above the ⋯ at the end of the header. The menu lists only the hidden columns (publish date, created date, address, summary, cover image, SEO title, share image). Choosing one adds that column.

### Step 02b: "열 · 열 이름을 잡고 옆으로 끌면 들려 따라오고 다른 열이 비켜요 · 놓으면 저장"

- Board: `Flow7Step02b.dc.html`
- Renders: `Main` (mode "열 옮기는 중")
- The user grabs a column name and drags it sideways. The column lifts and follows the pointer and the other columns move aside; dropping saves the new order.

### Step 02c: "쪽마다 · 아래 범위 옆 25개씩 ▾ → 25 · 50 · 100"

- Board: `Flow7Step02c.dc.html`
- Renders: `Main` (mode "쪽마다")
- The user opens the per-page control beside the range under the list ("25개씩 ▾"). Choices: 25, 50, 100.

## "찾기" · Search

### Step 03: "찾기 · 검색창 앞에서 찾을 곳 고르기 · 전체 · 제목 · 주소 · 본문"

- Board: `Flow7Step03.dc.html`
- Renders: `Main` (mode "찾을 곳 고르기")
- Before the search box the user opens the scope picker: all, title, address, body.

## "값으로 거르기" · Filter by value

### Step 04: "거르기 · 상태 이름 → 발행됨 · 수정 중 · 초안 · 보관됨 · 고르면 칩과 이름 옆 점 · 메뉴는 열린 채"

- Board: `Flow7Step04.dc.html`
- Renders: `Main` (mode "상태 메뉴")
- The user clicks the status column name. The menu lists published, editing, draft, archived with counts. Picking one adds a chip and a dot beside the column name, and the menu stays open.

### Step 04b: "거르기 · 태그 이름 → 태그 찾기 · 맨 위 없음 · 태그마다 글 수 · 열 숨기기"

- Board: `Flow7Step04b.dc.html`
- Renders: `Main` (mode "태그 메뉴")
- The user clicks the tag column name. The menu has a tag search box, "없음" (no tag) at the top, each tag with its post count, and hide column.

### Step 04c: "거르기 · 언어 이름 → 언어 | 번역 · 원문 바뀜을 고르면 칩 "번역: 원문 바뀜""

- Board: `Flow7Step04c.dc.html`
- Renders: `Main` (mode "언어 메뉴")
- The user clicks the language column name. The menu has two groups, language and translation. Picking "원문 바뀜" adds the chip "번역: 원문 바뀜".

### Step 04d: "거르기 · + 로 검색 설명 열을 켜고 그 이름 → 비어 있음 → 칩 "검색 설명 비어 있음""

- Board: `Flow7Step04d.dc.html`
- Renders: `Main` (mode "검색 설명 메뉴")
- The user turns on the SEO description column with +, then opens its name and picks "비어 있음" (empty). The chip "검색 설명 비어 있음" appears.

### Step 04e: "거르기 · 걸린 필터마다 칩 하나 · 열 이름에 점 · 칩의 ×로 하나씩 풀어요"

- Board: `Flow7Step04e.dc.html`
- Renders: `Main` (mode "여러 필터")
- Several filters at once: one chip per active filter, a dot on each filtered column name, and each chip's × removes just that filter.

## "날짜로 거르기" · Filter by date

### Step 05: "날짜 · 수정일 이름 → 최근부터 · 오래전부터 | 오늘 · 최근 7일 · 최근 30일 · 기간 고르기 → 칩"

- Board: `Flow7Step05.dc.html`
- Renders: `Main` (mode "수정일 메뉴")
- The user clicks the modified-date column name. The menu has sort (newest first, oldest first), then ranges (today, last 7 days, last 30 days) and "기간 고르기" (pick a range). A chosen range becomes a chip.

### Step 05b: "날짜 · 기간 고르기 → 옆에 달력 · 처음 누른 날부터 다음 누른 날까지"

- Board: `Flow7Step05b.dc.html`
- Renders: `Main` (mode "기간 고르기")
- The user picks "기간 고르기". A calendar opens beside the menu; the range runs from the first day clicked to the next day clicked.

### Step 05c: "날짜 · 두 번째 날을 누르면 기간이 걸리고 달력은 그 기간을 보여 주며 열린 채 → 칩 "수정한 날: 10. 05 – 10. 16""

- Board: `Flow7Step05c.dc.html`
- Renders: `Main` (mode "기간 걸림")
- The user clicks the second day. The range is applied, the calendar shows the range and stays open, and the chip reads "수정한 날: 10. 05 – 10. 16".

## "여러 글 바꾸기" · Change many posts

### Step 10: "여러 글 · 둘을 고르면 열 이름 줄 자리에 일괄 작업 줄 · 바꾸기 ▾ › 태그 › 모두 ☑ · 일부 – 1/2 · 없음 ☐"

- Board: `Flow7Step10.dc.html`
- Renders: `Main` (mode "바꾸기 메뉴")
- The user selects two posts. A bulk bar replaces the column header row. "바꾸기 ▾ › 태그" opens a tag list where each tag shows a state: checked for all selected, "–" with 1/2 for some, unchecked for none.

## "태그 합치기" · Merge tags

### Step 06: "분류 · 태그 목록 · 글 수 · 쓰는 글 없음"

- Board: `Flow7Step06.dc.html`
- Renders: `Taxonomy` (stage "태그")
- Taxonomy, tags tab. The tag list shows each tag's post count, and tags used by no post.

### Step 07: "분류 · 같은 뜻의 태그 둘을 고름 → 합치기"

- Board: `Flow7Step07.dc.html`
- Renders: `Taxonomy` (stage "태그 고름")
- The user selects two tags that mean the same thing. A bar shows "2개 선택" with "합치기" (merge), trash and clear selection.

### Step 08: "분류 · 남길 이름 고르기 · 바뀌는 글 수 · 사라지는 주소"

- Board: `Flow7Step08.dc.html`
- Renders: `Taxonomy` (stage "태그 합치기")
- The user presses merge. A dialog "어느 이름으로 합칠까요?" asks which name to keep and states the effect: the 3 posts with React become "리액트", React goes to the trash, and the address /tag/react-en disappears. Buttons: cancel and the names to keep.

### Step 09: "분류 · 합친 뒤 · 글 3편이 리액트로 · 되돌리기"

- Board: `Flow7Step09.dc.html`
- Renders: `Taxonomy` (stage "태그 합침")
- After merging, a notice says the tags of 3 posts were changed to "리액트", with "되돌리기"; the kept tag now shows its new post count.

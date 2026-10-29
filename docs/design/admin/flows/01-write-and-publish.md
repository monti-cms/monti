# 흐름 1: 글 쓰고 발행하기

이 파일은 캔버스 흐름 1 "흐름 1 · 글 쓰고 발행하기"의 모든 행과 단계를 적는다. 첫 슬래시부터 발행, 발행 뒤 고치기까지 글을 쓰는 흐름이고, 예외가 둘 있다. 편집 충돌과 브라우저 초안 복구다.

캔버스 메모: "흐름 1 · 글 쓰고 발행하기 — 새 글부터 발행 후 고치기까지, 예외 둘(편집 충돌, 임시 저장본 복구)"

쓰는 화면: [`Main`](../screens.md#main), [`EditorNotion`](../screens.md#editornotion), [`EditorCompare`](../screens.md#editorcompare).

단계는 흐름 테스트의 계약이다. 단계마다 보드 파일, 그리는 화면과 상태, 사용자가 하는 일과 보는 것을 적는다. 번호에 글자가 붙은 단계(예: 04b)는 바로 앞 단계의 변형이거나 그다음 순간이다.

## "글 쓰고 발행하기"

### 단계 01: "게시글 목록에서 새 글 쓰기"

- 보드: `Flow1Step01.dc.html`
- 화면: `Main` (default mode "처음 화면")
- 사용자가 게시글 목록에서 새 글 버튼으로 새 글을 시작한다. 화면은 기본 게시글 목록이다.

### 단계 02: "새 글 · / 로 템플릿 고르기"

- 보드: `Flow1Step02.dc.html`
- 화면: `EditorNotion` (doc "새 글"; state "템플릿 고르기"; pub "초안"; todo-open off)
- 제목이 빈 새 글이 열린다(0자, 아직 저장 안 됨). 사용자가 `/`를 치면 그 자리에서 템플릿 목록이 열린다. "기본 글"(도입, 본문, 맺음), "책 리뷰"(한 줄 평, 줄거리, 인용, 생각), "튜토리얼"(준비물, 단계, 코드, 마무리)이다. 아래쪽에는 글을 발행할 때 제목으로 주소를 만든다고 적혀 있다.
- 테스트: `packages/admin/src/editor/__test__/writing-flow.test.tsx` ("flow: write (steps 02–05)")

### 단계 03: "쓰기 · 블록 손잡이와 서식 카드"

- 보드: `Flow1Step03.dc.html`
- 화면: `EditorNotion` (default state "글자 고름 + 블록 메뉴"; pub "초안"; todo-open off)
- 사용자가 글자를 고른다. 그 위에 서식 카드(굵게, 기울임, 밑줄, 취소선, 코드, 링크, ✦ 요청)가 나타나고, 블록 손잡이 메뉴가 열려 있다. 다른 블록으로 바꾸기, 정렬, 위로 옮기기(⌥↑), 아래로 옮기기(⌥↓), 복제(⇧⌘D), 삭제(⇧⌘⌫)다. 상태는 저장하지 않은 변경이 있다고 보여 준다.
- 테스트: `packages/admin/src/editor/__test__/writing-flow.test.tsx` ("flow: write (steps 02–05)")

### 단계 04: "쓰기 · 손잡이 → 다른 블록으로 바꾸기"

- 보드: `Flow1Step04.dc.html`
- 화면: `EditorNotion` (state "블록 바꾸기"; pub "초안"; todo-open off)
- 사용자가 블록 손잡이 메뉴에서 "다른 블록으로 바꾸기"를 연다. 하위 메뉴에 블록 종류(제목 2, 3, 4, 목록 등)가 나온다.
- 테스트: `packages/admin/src/editor/__test__/writing-flow.test.tsx` ("flow: write (steps 02–05)")

### 단계 05: "쓰기 · 손잡이 → 정렬"

- 보드: `Flow1Step05.dc.html`
- 화면: `EditorNotion` (state "블록 정렬"; pub "초안"; todo-open off)
- 사용자가 블록 손잡이 메뉴에서 "정렬"을 연다. 하위 메뉴에 왼쪽, 가운데, 오른쪽이 있다.
- 테스트: `packages/admin/src/editor/__test__/writing-flow.test.tsx` ("flow: write (steps 02–05)")

### 단계 06: "쓰기 · 하단 플러그인 칸 → 판에서 하나씩 고치기"

- 보드: `Flow1Step06.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; todo-open off; plugin-open on)
- 사용자가 편집기 아래쪽의 플러그인 띠(맞춤법 검사)를 연다. 찾은 것이 하나씩 나열된다. 예를 들어 "몇일 → 며칠", "안되요 → 안 돼요"이고, 저마다 고치기 버튼이 있다. 설정 링크와 "모두 고치기"도 있다. 사용자는 패널에서 하나씩 고친다.

### 단계 07: "속성 정하기 · 기본"

- 보드: `Flow1Step07.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; series-pending on; todo-open off)
- 사용자가 글 속성의 기본 탭을 정한다. 시리즈 필드는 고르는 중이고, "리액트 다시 만들기" 시리즈를 제안한다.
- 테스트: `packages/admin/src/screens/entries/__test__/properties-flow.test.tsx` ("flow: set properties")

### 단계 08: "속성 정하기 · SEO"

- 보드: `Flow1Step08.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; panel-tab "SEO"; todo-open off)
- 사용자가 속성 패널을 SEO 탭으로 바꾼다. SEO 제목("제목과 같음", 10/60), SEO 설명("요약과 같음"), 공유 이미지("표지와 같음"), 검색에서 숨기기("아니요")가 있다.
- 테스트: `packages/admin/src/screens/entries/__test__/properties-flow.test.tsx` ("flow: set properties")

### 단계 09: "저장 ⌘S · 서버에 저장됨"

- 보드: `Flow1Step09.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo-open off)
- 사용자가 ⌘S로 저장한다. 상태 표시줄이 저장하지 않은 변경에서 서버에 저장됨으로 바뀐다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: write and publish (steps 09–15)`)

### 단계 10: "발행하기 → 막힘 · 할 일 2"

- 보드: `Flow1Step10.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; toast "발행 막힘"; todo-open on)
- 필수 필드가 아직 비어 있는데 사용자가 발행을 누른다. 발행이 막히고, 토스트가 할 일 2개를 먼저 하라고 알리며, 할 일 패널이 열린다. 항목은 둘이다. 요약 쓰기(비어 있음)와 이미지 2개에 대체 텍스트 넣기(표지 이미지, 본문 이미지 1)다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: write and publish (steps 09–15)`)

### 단계 11: "할 일 1 · 요약 쓰기"

- 보드: `Flow1Step11.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; fix "요약"; todo-open off)
- 할 일 1. 사용자가 속성 패널에서 요약을 쓴다. 글자 수는 120자 중 28자다.
- 테스트: `packages/admin/src/screens/entries/__test__/properties-flow.test.tsx` ("flow: set properties")

### 단계 12: "할 일 2 · 이미지 대체 텍스트"

- 보드: `Flow1Step12.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; fix "대체 텍스트"; todo-open off)
- 할 일 2. 사용자가 이미지의 대체 텍스트를 쓰고(80자 중 23자) "다음 이미지"로 넘어간다.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (다음 이미지: flow: upload in the editor (05–06))

### 단계 13: "할 일 다 채움 → 발행하기 (저장도 같이)"

- 보드: `Flow1Step13.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "다 채움"; todo-open on)
- 할 일을 모두 채웠고 패널에는 "할 일 없음"이라고 적혀 있다. 확인한 것도 나열된다. 이미지 대체 텍스트, 제목, 주소, 표지 이미지다. 사용자가 발행을 누르면 글도 함께 저장된다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: write and publish (steps 09–15)`)

### 단계 14: "발행됨"

- 보드: `Flow1Step14.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "발행됨"; save "저장됨"; todo "다 채움"; toast "발행됨"; todo-open off)
- 글이 발행된다. 상태는 발행됨이고, 토스트가 "보기" 동작과 함께 "발행되었어요"라고 알린다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: write and publish (steps 09–15)`)

### 단계 15: "발행 후 고침 → 수정 중 · 다시 발행"

- 보드: `Flow1Step15.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "저장됨"; todo "다 채움"; pub-menu on; todo-open off)
- 사용자가 발행 뒤에 글을 고친다. 상태가 "수정 중"이 되고, 발행 메뉴에 두 가지가 있다. 원래 날짜를 그대로 두고 다시 발행하기("발행일 2026. 10. 01 그대로")와 오늘 날짜로 다시 발행하기("오늘 날짜로 다시 발행", 2026. 10. 26)다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: write and publish (steps 09–15)`)

## "다른 곳에서 먼저 저장"

### 단계 16: "예외 · 다른 곳에서 먼저 저장 → 알림 줄"

- 보드: `Flow1Step16.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "편집 충돌"; todo "다 채움"; dialog "편집 충돌"; todo-open off)
- 예외: 다른 곳에서 글을 먼저 저장했다. 알림 줄이 10:41에 다른 곳에서 저장되어 이 글을 저장할 수 없다고 알리고, "비교하기"와 "서버 최신본 불러오기"를 보여 준다. 상태는 편집 충돌이다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: saved elsewhere first`)

### 단계 17: "비교하기 → 양쪽 글을 보고 한쪽 고르기"

- 보드: `Flow1Step17.dc.html`
- 화면: `EditorCompare` (mode "편집 충돌")
- 사용자가 비교를 연다. 두 판이 나란히 놓인다. 사용자의 입력(저장 안 됨)과 서버 최신본(v4, 10:41 저장)이다. 사용자는 하나를 고른다. 서버 판을 불러오거나, 자기 입력을 저장한다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: saved elsewhere first`)

## "다시 열었을 때 임시 저장본"

### 단계 18: "예외 · 다시 열었을 때 임시 저장본 → 알림 줄"

- 보드: `Flow1Step18.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "수정 중"; save "브라우저에만 임시 저장됨"; todo "다 채움"; dialog "임시 저장본 복구"; todo-open off)
- 예외: 저장하지 않은 수정이 이 브라우저에만 남아 있는 글을 사용자가 다시 연다. 알림 줄이 그렇다고 알리고(10. 26 10:12) "비교하기", "불러오기", "버리기"를 보여 준다. 상태는 브라우저에만 저장됨이다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: browser draft on reopening`)

### 단계 19: "비교하기 → 양쪽 글을 보고 한쪽 고르기"

- 보드: `Flow1Step19.dc.html`
- 화면: `EditorCompare` (mode "임시 저장본")
- 사용자가 브라우저 초안의 비교를 연다. 브라우저 초안(10. 26 10:12)이 서버 사본(10. 26 09:58) 옆에 놓인다. 사용자는 하나를 고른다. 초안을 불러오거나 버린다.
- 테스트: `packages/admin/src/screens/entries/__test__/write-and-publish-flow.test.tsx` (`flow: browser draft on reopening`)

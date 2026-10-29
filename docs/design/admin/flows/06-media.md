# 흐름 6: 미디어

이 파일은 캔버스 흐름 6 "흐름 6 · 미디어"의 모든 행과 단계를 적는다. 올리기, 편집기에서 넣기, 둘러보기, 파일 바꾸기, 대체 텍스트, 지우기, 이미지가 아닌 파일, 고르기, 예외를 다룬다.

캔버스 메모: "흐름 6 · 미디어 — 올리기 · 편집기에서 넣기 · 둘러보기 · 파일 바꾸기 · 대체 텍스트 · 지우기 · 이미지가 아닌 파일 · 고르기 · 예외"

쓰는 화면: [`Media`](../screens.md#media), [`EditorNotion`](../screens.md#editornotion), [`ImageInsert`](../screens.md#imageinsert).

단계는 흐름 테스트의 계약이다. 단계마다 보드 파일, 그리는 화면과 상태, 사용자가 하는 일과 보는 것을 적는다. 번호에 글자가 붙은 단계(예: 04b)는 바로 앞 단계의 변형이거나 그다음 순간이다.

## "올리기"

### 단계 01: "올리기 · 끌어 오면 지금 폴더에 테두리 · 아래 알약 "여기에 올려요""

- 보드: `Flow6Step01.dc.html`
- 화면: `Media` (mode "끌어 놓기")
- 사용자가 파일을 미디어 라이브러리 위로 끌어 온다. 지금 폴더에 테두리가 생기고, 아래쪽 알약에 "여기에 올려요"라고 나온다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 02: "올리기 · 하위 폴더 위로 가면 그 폴더만 강조 · "covers에 올려요""

- 보드: `Flow6Step02.dc.html`
- 화면: `Media` (mode "폴더 위로 끌기")
- 사용자가 하위 폴더 위로 끌어 간다. 그 폴더만 강조되고, 알약에 그 폴더 이름이 나온다("covers에 올려요").
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 03: "올리기 · 올리는 중"

- 보드: `Flow6Step03.dc.html`
- 화면: `Media` (mode "올리는 중")
- 올리는 중이다. 파일마다 썸네일과 함께 진행 상황("올리는 중 · 64%")이나 "대기"가 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 04: "올리기 · 실패한 파일은 그 자리에 남음 · 줄여서 다시 · 빼기"

- 보드: `Flow6Step04.dc.html`
- 화면: `Media` (mode "올리기 실패")
- 실패한 파일은 이유와 함께 그 자리에 남는다. "올릴 수 없는 형식"(HEIC)에는 빼기가 있고, 너무 큰 파일(14 MB, 한도 10 MB)에는 "줄여서 다시"와 빼기가 있다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "편집기에서 올리기"

### 단계 05: "편집기 · 붙여넣거나 끌어 놓으면 커서 자리에 바로 · 올리는 중"

- 보드: `Flow6Step05.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "올리는 중")
- 사용자가 편집기에서 이미지를 붙여넣거나 끌어 놓는다. 이미지는 바로 커서 자리에 들어가고, 올리는 중 상태와 캡션 칸이 보인다.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: upload in the editor (05–06))

### 단계 06: "편집기 · 이미지를 누르면 설정 · 대체 텍스트 · 캡션 · ✦ 채우기"

- 보드: `Flow6Step06.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "설정")
- 사용자가 편집기에서 이미지를 누른다. 설정 카드가 열린다: 캡션, 너비(본문 너비), 대체 텍스트(직접 쓰거나 꾸밈용 이미지로 표시하라는 안내가 붙는다), 그리고 "✦ 채우기" 동작.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: upload in the editor (05–06))

## "둘러보기"

### 단계 07: "둘러보기 · 미디어 맨 위 · 폴더와 폴더에 넣지 않은 파일"

- 보드: `Flow6Step07.dc.html`
- 화면: `Media` (mode "최상위")
- 라이브러리 맨 위에는 폴더와, 어느 폴더에도 넣지 않은 파일이 폴더 수, 파일 수와 함께 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 08: "둘러보기 · 폴더 안 (Blog Assets) · 하위 폴더 · 파일"

- 보드: `Flow6Step08.dc.html`
- 화면: `Media` (mode "폴더 안")
- 폴더(Blog Assets) 안에서는 라이브러리가 그 폴더의 하위 폴더와 파일을 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 09: "둘러보기 · + 폴더 → 그 자리에 새 폴더 · 이름이 골라진 채로"

- 보드: `Flow6Step09.dc.html`
- 화면: `Media` (mode "새 폴더")
- 사용자가 "+ 폴더"를 누른다. 그 자리에 새 폴더가 이름이 골라진 채로 나타난다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 10: "둘러보기 · 폴더를 우클릭 → 열기 · 이름 바꾸기 · 옮기기 ▸ · 폴더 지우기"

- 보드: `Flow6Step10.dc.html`
- 화면: `Media` (mode "폴더 우클릭")
- 사용자가 폴더를 우클릭한다. 메뉴에 열기, 이름 바꾸기, 옮기기 ▸, 폴더 지우기가 있다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 13: "둘러보기 · 빈 곳을 우클릭 → 올리기 · 새 폴더"

- 보드: `Flow6Step13.dc.html`
- 화면: `Media` (mode "빈 곳 우클릭")
- 사용자가 빈 곳을 우클릭한다. 메뉴에 올리기와 새 폴더가 있다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 14: "둘러보기 · 목록 보기 · 사용 · 형식 · 크기 · 치수 · 올린 날"

- 보드: `Flow6Step14.dc.html`
- 화면: `Media` (mode "목록 보기")
- 목록 보기다. 열: 이름, 사용(그 파일을 쓰는 글 수, 또는 안 씀), 형식, 크기, 치수, 올린 날.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 15: "둘러보기 · 검색 → 찾는 곳을 모든 폴더로 넓힘 · 경로가 보임"

- 보드: `Flow6Step15.dc.html`
- 화면: `Media` (mode "찾는 중")
- 사용자가 검색한다. 찾는 범위가 모든 폴더로 넓어지고, 결과마다 폴더 경로와 쓰는 수 또는 안 씀이 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 16: "둘러보기 · 파일 열기 → 옆 패널 · 쓰는 곳"

- 보드: `Flow6Step16.dc.html`
- 화면: `Media` (mode "파일 열기")
- 사용자가 파일을 연다. 옆 패널에 주소 복사, 새 탭에서 열기, 파일 이름, 폴더, 기본 대체 텍스트(채우기 동작이 있다), 기본 캡션, 형식, 크기(웹 2400×1600, 원본 4032×2688), 올린 날, 그리고 쓰는 곳이 보인다. 쓰는 곳은 글마다 한 행이고, 행 끝에 그 글 안의 자리가 나온다(필드 라벨 "대표 이미지", 또는 본문이면 "본문").
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 17: "둘러보기 · 파일을 우클릭 → 열기 · 쓰는 곳 ▸ · 폴더로 ▸"

- 보드: `Flow6Step17.dc.html`
- 화면: `Media` (mode "파일 메뉴")
- 사용자가 파일을 우클릭한다. 메뉴에 열기, "쓰는 곳 ▸"(쓰는 글과 그 안의 자리, 예를 들어 대표 이미지나 본문), 폴더로 옮기기 ▸가 있다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "폴더 지우기"

### 단계 11: "지우기 · 폴더 지우기 → 확인 없이 폴더째 휴지통으로 · 되돌리기"

- 보드: `Flow6Step11.dc.html`
- 화면: `Media` (mode "폴더 지움")
- 폴더를 지울 때 확인은 묻지 않는다. 폴더는 안의 파일과 함께 휴지통으로 가고, 알림이 그렇다고 알리며 "되돌리기"를 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 12: "지우기 · 쓰는 파일이 있는 폴더 → 그 파일만 폴더째 남김 · 보기"

- 보드: `Flow6Step12.dc.html`
- 화면: `Media` (mode "폴더 일부 남김")
- 쓰이는 파일이 든 폴더를 지운다: 쓰이지 않는 파일만 옮겨지고, 폴더는 쓰이는 파일과 함께 남는다. 알림이 2개를 옮겼고 4개는 쓰이고 있어 남았다고 알리며 "보기"를 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "파일 바꾸기"

### 단계 18: "고치기 · 옆 패널 ⋯ → 파일 바꾸기 → 파일 고르기"

- 보드: `Flow6Step18.dc.html`
- 화면: `Media` (mode "바꾸기 메뉴")
- 사용자가 옆 패널에서 ⋯를 연다: 파일 바꾸기, ID 복사, 휴지통으로 옮기기(주소 복사와 새 탭에서 열기는 패널 본문의 그림 아래에 있다). "파일 바꾸기"를 고르고 파일을 고른다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 19: "고치기 · 고른 파일 확인 → 쓰는 곳 2곳이 새 파일로"

- 보드: `Flow6Step19.dc.html`
- 화면: `Media` (mode "파일 바꾸기")
- 사용자가 고른 파일을 확인한다. 옆 패널은 옛 파일을 쓰던 2곳이 새 파일을 쓰게 된다고 알린다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "여러 개 옮기기"

### 단계 20: "고치기 · 여러 개 선택"

- 보드: `Flow6Step20.dc.html`
- 화면: `Media` (mode "여러 개 선택")
- 사용자가 파일 여러 개를 고른다. 일괄 막대에 개수와 함께 폴더로 옮기기, 휴지통, 선택 해제가 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 21: "고치기 · 폴더로 옮기기"

- 보드: `Flow6Step21.dc.html`
- 화면: `Media` (mode "폴더로 옮기기")
- 사용자가 일괄 막대에서 "폴더로"를 연다. 메뉴에 최상위, 폴더들, "+ 새 폴더"가 나온다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "대체 텍스트 채우기"

### 단계 22: "대체 텍스트 · 필터 열기 → 없음 · 있음 (지금 폴더와 하위 폴더)"

- 보드: `Flow6Step22.dc.html`
- 화면: `Media` (mode "필터 열기")
- 사용자가 필터를 연다. 대체 텍스트: 없음 | 있음. 지금 폴더와 그 하위 폴더에 걸리고, 개수가 함께 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 23: "대체 텍스트 · 없음 → 칩 “대체 텍스트: 없음 ×” · 찾는 곳 Blog Assets | 모든 폴더"

- 보드: `Flow6Step23.dc.html`
- 화면: `Media` (mode "필터 걸림")
- 사용자가 "없음"을 고른다. 칩 "대체 텍스트: 없음 ×"가 나타나고, 찾는 범위에 "Blog Assets | 모든 폴더"가 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 24: "대체 텍스트 · 없는 것 모두 선택"

- 보드: `Flow6Step24.dc.html`
- 화면: `Media` (mode "대체 텍스트 없는 것 고름")
- 사용자가 대체 텍스트가 없는 파일을 모두 고른다. 일괄 막대에 "3개 선택"이 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 25: "대체 텍스트 · ✦ 대체 텍스트 → 파란 제안 3 · 모두 버리기 · 모두 받기"

- 보드: `Flow6Step25.dc.html`
- 화면: `Media` (mode "대체 텍스트 제안")
- 사용자가 "✦ 대체 텍스트"를 누른다. 파일 3개에 파란 제안이 나타나고("제안 3"), "모두 버리기"와 "모두 받기"가 보인다.

### 단계 26: "대체 텍스트 · 제안 하나를 눌러 메모 → 그 자리에서 다시 고침 · 버리기 · 받기"

- 보드: `Flow6Step26.dc.html`
- 화면: `Media` (mode "대체 텍스트 메모")
- 사용자가 제안 하나를 눌러 메모를 단다. 어시스턴트가 그 자리에서 다시 고친다. 제안마다 버리거나 받을 수 있다.

## "파일 지우기"

### 단계 27: "지우기 · 휴지통으로 → 되돌리기"

- 보드: `Flow6Step27.dc.html`
- 화면: `Media` (mode "휴지통으로 옮김")
- 파일을 지우면 휴지통으로 옮겨진다. 알림이 그렇다고 알리며 "되돌리기"를 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 28: "지우기 · 쓰는 곳이 있는 파일은 남김"

- 보드: `Flow6Step28.dc.html`
- 화면: `Media` (mode "일부 남김")
- 쓰이는 파일은 옮겨지지 않는다. 알림이 1개를 옮겼고 1개는 쓰이고 있어 남겼다고 알리며 "보기"를 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "편집기에서 고르기"

### 단계 29: "고르기 · 편집기 / → 이미지 → 라이브러리 · 고르면 바로 들어감"

- 보드: `Flow6Step29.dc.html`
- 화면: `ImageInsert` (stage "라이브러리")
- 사용자가 편집기에서 `/`를 치고 이미지 › 라이브러리를 고른다. 라이브러리가 열리고, 이미지를 고르면 바로 들어간다.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: pick in the editor (29–30))

### 단계 30: "고르기 · 대표 이미지 칸"

- 보드: `Flow6Step30.dc.html`
- 화면: `ImageInsert` (stage "대표 이미지")
- 사용자가 대표 이미지 필드를 연다. 같은 라이브러리가 열리고 "고르기" 동작이 보인다.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: pick in the editor (29–30))

## "종류로 거르기"

### 단계 32: "거르기 · 종류 ▾ → 이미지 · 파일"

- 보드: `Flow6Step32.dc.html`
- 화면: `Media` (mode "종류 열기")
- 사용자가 종류 필터를 연다. 선택지는 이미지(개수)와 파일이다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 33: "거르기 · 종류: 파일 → 파일만 · 대체 텍스트 거르기가 빠짐"

- 보드: `Flow6Step33.dc.html`
- 화면: `Media` (mode "종류 파일")
- 사용자가 파일을 고른다. 목록에는 파일만 보이고, 칩 "종류: 파일"이 나타나며, 대체 텍스트 필터는 해당하지 않으므로 빠진다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

## "PDF 같은 파일"

### 단계 34: "파일 · PDF 올리기 → 미리보기 대신 파일 아이콘 · PDF · 이름 · 이미지와 같은 올리는 중"

- 보드: `Flow6Step34.dc.html`
- 화면: `Media` (mode "PDF 올리는 중")
- 사용자가 PDF나 다른 파일을 올린다. 타일에는 미리보기 대신 파일 아이콘과 형식(PDF, CSV), 이름이 보인다. 올리는 중 상태는 이미지와 같다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 35: "파일 · 받지 않는 형식(.exe) → 그 자리에 남고 받는 종류 한 줄 · 빼기"

- 보드: `Flow6Step35.dc.html`
- 화면: `Media` (mode "받지 않는 형식")
- 예외: 받지 않는 형식(.exe)이다. 파일은 그 자리에 남고, 받는 종류(이미지, PDF, ZIP, 텍스트만)를 적은 한 줄과 빼기 동작이 보인다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 36: "파일 · 파일 열기 → 옆 패널 · 이름 · 종류 · 크기 · 쓰는 곳 · 주소 복사 · 파일 바꾸기 · 휴지통으로 (대체 텍스트 없음)"

- 보드: `Flow6Step36.dc.html`
- 화면: `Media` (mode "PDF 열기")
- 사용자가 PDF를 연다. 옆 패널에 이름, 형식, 크기, 올린 날, 쓰는 곳, 주소 복사, 파일 바꾸기, 휴지통으로 옮기기가 보인다. 대체 텍스트는 없다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

### 단계 37: "파일 · 편집기 / 파일 → 파일만 보이는 라이브러리"

- 보드: `Flow6Step37.dc.html`
- 화면: `ImageInsert` (stage "파일")
- 사용자가 편집기에서 `/` › 파일을 고른다. 라이브러리가 파일만(PDF, CSV, ZIP, MD) 보여 주며 열리고, 종류 필터가 있다.
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: files such as PDF (37–38))

### 단계 38: "파일 · 고르면 본문에 파일 블록 · 아이콘 · 이름 · PDF · 크기"

- 보드: `Flow6Step38.dc.html`
- 화면: `EditorNotion` (state "아무것도 안 할 때"; pub "초안"; save "저장됨"; todo "남음"; todo-open off; img "파일")
- 고르고 나면 본문에 파일 블록이 들어간다. 아이콘, 이름, 형식, 크기가 보인다(price-list-2026.pdf, PDF, 1.2 MB).
- 테스트: `packages/admin/src/editor/__test__/editor-media-flow.test.tsx` (flow: files such as PDF (37–38))

## "예외"

### 단계 31: "예외 · 저장소가 없음"

- 보드: `Flow6Step31.dc.html`
- 화면: `Media` (mode "저장소 없음")
- 예외: 사이트에 미디어 저장소가 없다. 화면은 "미디어 저장소가 없어요"라고 말하고, 올리려면 저장소가 필요하다고 알리며 "연결 방법"을 보여 준다.
- 테스트: `packages/admin/src/screens/media/__test__/media-flows.test.tsx`

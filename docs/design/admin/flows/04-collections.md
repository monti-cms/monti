# 흐름 4: 컬렉션

이 파일은 캔버스 흐름 4 "흐름 4 · 컬렉션"의 모든 행과 단계를 적는다. 개발 서버에서 컬렉션을 만들고, 필드를 고치고, 공개 주소를 바꾸고, 지우는 일을 다룬다.

캔버스 메모: "흐름 4 · 컬렉션 — 새 컬렉션 · 필드 고치기 · 주소 바꾸기 · 컬렉션 지우기 (개발 서버)"

쓰는 화면: [`Schema`](../screens.md#schema).

단계는 흐름 테스트의 계약이다. 단계마다 보드 파일, 그리는 화면과 상태, 사용자가 하는 일과 보는 것을 적는다. 번호에 글자가 붙은 단계(예: 04b)는 바로 앞 단계의 변형이거나 그다음 순간이다.

## "새 컬렉션"

### 단계 01: "새 컬렉션 · 이름 · 식별자 · 종류 · 공개 주소(앞부분만) → 만들기"

- 보드: `Flow4Step01.dc.html`
- 화면: `Schema` (stage "새 컬렉션")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 사용자가 설정 › 컬렉션에서 새 컬렉션을 시작한다. 폼은 이름, 식별자, 종류(문서: 글이나 노트처럼 본문이 있다. 항목: 카테고리나 태그처럼 짧다), 공개 주소(앞부분만, /:slug로 끝난다)를 묻는다. 사용자가 "만들기"를 누른다.

### 단계 02: "새 컬렉션 · 오류 · 이미 쓰는 식별자"

- 보드: `Flow4Step02.dc.html`
- 화면: `Schema` (stage "새 컬렉션 오류")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 오류: 식별자를 이미 쓰고 있다. 식별자 필드에 "이미 쓰는 이름이에요."가 보이고 폼은 열려 있다.

### 단계 03: "새 컬렉션 · title · slug 두 필드로 시작 · 아직 저장 전"

- 보드: `Flow4Step03.dc.html`
- 화면: `Schema` (stage "만든 직후")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 컬렉션이 사이드바의 설정 목록에 title과 slug 두 필드를 가지고 생긴다. 아직 저장하지 않았다.

### 단계 04: "새 컬렉션 · + 필드 추가"

- 보드: `Flow4Step04.dc.html`
- 화면: `Schema` (stage "노트 필드 추가"; sheet-kind "글자")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 사용자가 필드를 더한다. 새 컬렉션에 필드 시트 "필드 추가"가 열린다(종류: 글자, 선택, 관계, 고급). 표시 이름, 이름, 도움말, 여러 줄, 최대 길이, 줄 수가 있다.

### 단계 05: "새 컬렉션 · 저장하고 적용 → 검토 · 데이터는 그대로"

- 보드: `Flow4Step05.dc.html`
- 화면: `Schema` (stage "새 컬렉션 검토")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 사용자가 "저장하고 적용"을 누른다. 검토가 변경(새 컬렉션, 공개 주소 /notes/:slug, 필드 title과 slug)을 나열하고 "저장된 데이터는 바뀌지 않아요."라고 말한다. 사용자가 "적용"을 누른다.

### 단계 06: "새 컬렉션 · 적용 → 사이드바에 노트"

- 보드: `Flow4Step06.dc.html`
- 화면: `Schema` (stage "만듦")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 적용됐다. 알림이 "보기" 동작과 함께 "노트" 컬렉션을 만들었다고 알리고, 컬렉션이 사이드바에 있다.

## "필드 고치기"

### 단계 07: "필드 고치기 · 이름 바꿈 · 지움 · 새 필수 → 바뀐 곳 3"

- 보드: `Flow4Step07.dc.html`
- 화면: `Schema` (stage "필드 바꿈")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 사용자가 필드를 고친다. 하나는 이름을 바꾸고(summary → excerpt), 하나는 지우고(subtitle), 하나는 새 필수 필드("글 종류", 선택)로 더한다. 필드 목록이 바뀐 것마다 표시하고, 헤더가 바뀐 곳 3개를 센다.

### 단계 08: "필드 고치기 · 속성 패널 미리보기 → 글 편집기에서 보일 모습 (저장 안 됨)"

- 보드: `Flow4Step08.dc.html`
- 화면: `Schema` (stage "미리보기")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 속성 패널 미리보기가 필드들이 글 편집기에서 어떻게 보일지 보인다("저장 안 됨"). 예를 들어 새 필수 필드 "글 종류"가 그 placeholder와 함께 보인다.

### 단계 09: "필드 고치기 · 고칠 곳이 있으면 미리보기 대신 고칠 곳 목록 · 저장하고 적용 막힘"

- 보드: `Flow4Step09.dc.html`
- 화면: `Schema` (stage "미리보기 오류")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 필드에 문제가 있으면(선택 필드에 선택지가 없다), 미리보기 대신 고칠 곳 목록이 보인다("고칠 곳이 있어 미리볼 수 없어요", "선택지가 없어요"). 저장하고 적용은 막힌다.

### 단계 10: "필드 고치기 · 바뀐 곳 ▾ → 하나씩 되돌리기"

- 보드: `Flow4Step10.dc.html`
- 화면: `Schema` (stage "바뀐 곳 목록")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 사용자가 "바뀐 곳 ▾" 목록을 연다. 바뀐 것마다 "되돌리기"로 하나씩 되돌릴 수 있다.

### 단계 11: "필드 고치기 · 검토 · 바꾼 것마다 값 처리 고르기"

- 보드: `Flow4Step11.dc.html`
- 화면: `Schema` (stage "필드 검토")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 검토. 사용자가 바꾼 것마다 값을 어떻게 할지 고른다. 이름을 바꾼 "summary → excerpt": 값을 옮기거나(글 148편) 빈 칸으로 시작한다. 지운 "subtitle": 값을 남기거나(글 132편), 다른 필드로 옮기거나, 지운다(값은 글에 남지만 사이트에서는 숨겨진다). 새 필수 필드 "글 종류": 빈 글 148편을 채우거나, 그대로 둔다(채우기 전까지 발행할 수 없다). 영향받는 글이 나열된다.

### 단계 12: "필드 고치기 · 값 지우기를 고르면 빨간 “지우고 적용”"

- 보드: `Flow4Step12.dc.html`
- 화면: `Schema` (stage "값 지우기")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 사용자가 값 지우기를 고르면 적용 버튼이 빨개지고 "지우고 적용"이 된다.

## "주소 바꾸기"

### 단계 13: "주소 바꾸기 · 공개 주소 고침"

- 보드: `Flow4Step13.dc.html`
- 화면: `Schema` (stage "주소 바꿈")
- 사용자가 컬렉션의 기본 탭에서 공개 주소를 바꾼다.

### 단계 14: "주소 바꾸기 · 검토 · 발행된 글 148편"

- 보드: `Flow4Step14.dc.html`
- 화면: `Schema` (stage "주소 검토")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 주소 변경 검토. 전과 후가 보인다(/posts/:slug → /blog/:slug). 검토는 발행된 글 148편의 주소가 바뀌고 옛 주소는 404가 된다고 말한다.

## "컬렉션 지우기"

### 단계 15: "컬렉션 지우기 · 기본 탭 맨 아래 “지우기”"

- 보드: `Flow4Step15.dc.html`
- 화면: `Schema` (stage "지우기 전")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 컬렉션의 기본 탭 맨 아래에 개수(글 23편, 그중 2편은 휴지통)와 함께 "지우기" 동작이 있다.

### 단계 16: "컬렉션 지우기 · 목록에서 바로 빠짐 · 바뀐 곳 · 되돌리기"

- 보드: `Flow4Step16.dc.html`
- 화면: `Schema` (stage "지울 예정")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 사용자가 지우기를 누르면 컬렉션이 곧바로 컬렉션 목록에서 빠지고 화면은 다음 컬렉션을 보인다. 저장하기 전에는 아무것도 지워지지 않는다. "바뀐 곳 ▾"에 "메모 · 컬렉션 지움"이 "되돌리기"와 함께 나오고, "메모를 지웠어요" 알림에도 "되돌리기"가 있다.

### 단계 17: "컬렉션 지우기 · 검토 · 지워지는 것 · 받아 두기 → 지우고 적용"

- 보드: `Flow4Step17.dc.html`
- 화면: `Schema` (stage "지우기 검토")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- "메모" 컬렉션 삭제 검토로, 이름 붙은 두 부분이 있다. "지워지는 것": 글 23편(휴지통 2편 포함)이 영구히 지워지고, 폴더 2개와 옛 주소 31개가 지워지며, 이 컬렉션을 가리키는 글 4편("첫 번째 글" 외 3편)의 그 연결이 끊기고("연결 끊김", 버튼 없이 적용이 한다), 본문 링크 2개가 깨진 링크로 보인다. "받아 두기": 컬렉션 내보내기. 위험 설명은 되돌릴 수 없다는 것과 운영 사이트는 배포할 때 지운다는 것을 말한다. "지우고 적용"은 처음부터 켜져 있다. 입력할 식별자는 없다.

### 단계 18: "컬렉션 지우기 · 지운 뒤"

- 보드: `Flow4Step19.dc.html`
- 화면: `Schema` (stage "지운 뒤")
- 테스트: `packages/admin/src/screens/schema/__test__/collections-flows.dom.test.tsx`
- 저장한 뒤 알림은 "적용됐어요"라고 말한다. 모든 저장이 끝에 보이는 같은 한 줄이다(무엇이 바뀌는지는 검토가 이미 보였다). 컬렉션은 설정 목록에서 사라졌다.

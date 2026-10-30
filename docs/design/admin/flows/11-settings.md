# 흐름 11: 설정

이 파일은 캔버스 흐름 11 "흐름 11 · 설정"의 모든 행과 단계를 적는다. 개발 서버(플러그인 없이 파일에 바로 쓴다), GitHub 플러그인이 있는 운영 환경(PR), 플러그인이 없는 운영 환경(자물쇠), 예외를 다룬다. 설정의 네 탭은 같은 규칙을 따른다.

캔버스 메모: "흐름 11 · 설정 — 개발 서버(플러그인 없이 파일에 바로) · 배포 + GitHub 플러그인(PR) · 배포, 플러그인 없음(자물쇠) · 예외 — 네 탭이 같은 규칙"

쓰는 화면: [`Settings`](../screens.md#settings), [`Locales`](../screens.md#locales), [`Schema`](../screens.md#schema), [`AssistantPanel`](../screens.md#assistantpanel), [`AdminSettings`](../screens.md#adminsettings).

단계는 흐름 테스트의 계약이다. 단계마다 보드 파일, 그리는 화면과 상태, 사용자가 하는 일과 보는 것을 적는다. 번호에 글자가 붙은 단계(예: 04b)는 바로 앞 단계의 변형이거나 그다음 순간이다.

## "개발 서버 · 사이트"

### 단계 01: "개발 서버 · 사이트 · 다른 호스트 이름 · + 호스트 → 줄에서 바로 입력"

- 보드: `Flow11Step01.dc.html`
- 화면: `Settings` (stage "호스트 추가")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 개발 서버, 설정 › 사이트. 사용자가 호스트 이름 줄에서 "+ 호스트"를 누르고, 새 호스트를 그 줄에 바로 입력한다(플레이스홀더 blog.example.dev).

### 단계 02: "개발 서버 · 사이트 · 미리보기 경로에 언어 넣기를 끔 → 미리보기 언어 쿼리 칸이 나타남 (비우면 locale)"

- 보드: `Flow11Step02.dc.html`
- 화면: `Settings` (stage "언어 쿼리")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 사용자가 "미리보기 경로에 언어 넣기"를 끈다. "미리보기 언어 쿼리" 필드가 나타난다. 비워 두면 `locale`이다.

### 단계 03: "개발 서버 · 사이트 · 칸 오류 · 홈 링크는 주소(/…)나 https:// → 저장 막힘"

- 보드: `Flow11Step03.dc.html`
- 화면: `Settings` (stage "칸 오류")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 필드 오류: 필드 아래에 짧은 한 줄이 있고, 필드는 잘못된 값으로 표시되며, 고칠 때까지 저장이 막힌다. 보드는 이것을 홈 링크에 그렸다. 사이트에는 홈 링크 설정이 없으므로, 코드에서는 같은 동작이 호스트 이름에 있다. 호스트 이름이 아닌 호스트("example dev" 같은)는 그 줄 아래에 "호스트 이름이 아니에요."가 붙는다.

### 단계 04: "개발 서버 · 나가려 할 때 · 저장하지 않은 바뀐 곳 → 확인 (계속 고치기 · 저장하지 않고 나가기)"

- 보드: `Flow11Step04.dc.html`
- 화면: `Settings` (stage "나가기 확인")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 사용자가 저장하지 않은 변경을 둔 채 나가려 한다. 대화상자가 나가면 바뀐 곳 2개가 사라진다고 알리고, "계속 고치기"와 "저장하지 않고 나가기"를 보여 준다.

## "개발 서버 · 언어"

### 단계 05: "개발 서버 · 언어 · + 언어 추가 → 코드 찾기 (맨 끝은 직접 입력)"

- 보드: `Flow11Step05.dc.html`
- 화면: `Locales` (stage "언어 찾기")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 개발 서버, 설정 › 언어. 사용자가 "+ 언어 추가"를 누른다. 코드 찾기가 열린다(zh를 치면 zh-Hans, zh-Hant, zh-HK가 그 언어 이름, 한국어 이름과 함께 나온다). 마지막 항목은 "직접 입력"이다.

### 단계 06: "개발 서버 · 언어 · 코드를 고르면 바로 줄이 생김 · 이름은 코드에서 → 바뀐 곳에 더해짐"

- 보드: `Flow11Step06.dc.html`
- 화면: `Locales` (stage "언어 추가됨")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 코드를 고르면 바로 줄이 생긴다(日本語, ja, 이름은 코드에서 가져온다). 이 변경은 변경 막대에 "모두 되돌리기", "저장하고 적용"과 함께 나온다.

### 단계 06b: "개발 서버 · 언어 · 직접 입력 → 이름을 한 번 묻는 작은 창"

- 보드: `Flow11Step06b.dc.html`
- 화면: `Locales` (stage "직접 입력")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- "직접 입력"을 고르면 작은 대화상자가 열려 코드, 그 언어로 쓴 이름, 표시 이름을 한 번 묻는다. 취소와 추가가 있다.

### 단계 07: "개발 서버 · 언어 · 원문 바꾸기 → 언어 고르기"

- 보드: `Flow11Step07.dc.html`
- 화면: `Locales` (stage "원문 메뉴")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 사용자가 원문 언어 메뉴("원문 바꾸기")를 열면 언어 고르기가 열린다.

### 단계 07b: "개발 서버 · 언어 · 고르면 맨 위로 · 원문이 바뀜 · 두 줄에 바뀐 곳 표시 (검토를 거쳐 저장)"

- 보드: `Flow11Step07b.dc.html`
- 화면: `Locales` (stage "원문 바꿈")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 고르고 나면 그 언어가 맨 위로 올라가 원문이 된다. 두 줄에 바뀐 곳 표시가 붙는다. 이 변경도 저장되기 전에 검토를 거친다.

### 단계 08: "개발 서버 · 언어 · 번역이 있는 언어를 ×로 빼기 → 검토 · 번역 12편 남겨 두기 · 휴지통으로 (흐름 4 · 11과 같은 방식)"

- 보드: `Flow11Step08.dc.html`
- 화면: `Locales` (stage "빼기 검토")
- 테스트: `packages/admin/src/screens/settings/__test__/settings-flows.dom.test.tsx`
- 테스트: `packages/admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`
- 사용자가 번역이 있는 언어를 ×로 뺀다. 검토가 영어 번역 12편을 어떻게 할지 묻는다. 남겨 두거나("남겨 두기") 휴지통으로 옮긴다("휴지통으로"). 언어를 다시 추가하면 번역이 돌아온다는 점도 적혀 있다. 흐름 4와 흐름 11의 검토와 같은 방식이다. 버튼: 취소, 적용.

## "배포 · GitHub 플러그인 있음"

### 단계 09: "배포 · GitHub 플러그인 있음 · 사이트 이름·글 쓰는 방식 같은 관리자 설정만 고침 → 버튼이 “저장” (바로 저장)"

- 보드: `Flow11Step09.dc.html`
- 화면: `Settings` (stage "운영 글 쓰는 방식")
- GitHub 플러그인이 있는 운영 환경. 사용자가 사이트 이름이나 글쓰기 규칙 같은 관리자 설정만 고친다. 저장 버튼은 "저장"이고 바로 저장한다.

### 단계 10: "배포 · GitHub 플러그인 있음 · 컬렉션을 고침 → 고치면 화면에 바로 · 저장 버튼은 “PR 만들기”"

- 보드: `Flow11Step10.dc.html`
- 화면: `Schema` (stage "운영 고침")
- GitHub 플러그인이 있는 운영 환경. 사용자가 컬렉션을 고친다(새 필드 "readingTime"). 변경은 화면에 바로 보이고, 저장 버튼은 "PR 만들기"다.

### 단계 11: "배포 · GitHub 플러그인 있음 · ✦ 요청 → 필드에 제안 표시"

- 보드: `Flow11Step11.dc.html`
- 화면: `Schema` (stage "운영 제안"; with-rail off) + `AssistantPanel` (view "스키마 변경")
- 사용자가 어시스턴트(✦)에게 필드를 추가해 달라고 한다. 필드 목록에 "✦ 제안" 표시가 붙은 제안이 보인다. 답장은 설정에 표시를 해 두었고, 이 사이트에서는 저장하면 PR이 열린다고 말한다.

### 단계 12: "배포 · GitHub 플러그인 있음 · 검토 → 파일 변경과 함께 PR 만들기"

- 보드: `Flow11Step12.dc.html`
- 화면: `Schema` (stage "운영 검토")
- PR 전 검토. 검토는 컬렉션의 변경과 monti.schema.ts의 파일 변경(+5줄, readingTime 필드)을 보여 준다. 버튼: 취소, "PR 만들기".

### 단계 13: "배포 · GitHub 플러그인 있음 · 사이트 · 미리보기 경로(파일)와 관리자 설정을 함께 고침 → PR 만들기 → 검토 · 바로 저장돼요 / PR로 가요 (흐름 11 · 12와 같은 검토)"

- 보드: `Flow11Step13.dc.html`
- 화면: `Settings` (stage "운영 검토")
- 파일 값(미리보기 경로, monti.schema.ts에 쓰임, +1 −1)과 관리자 설정(글쓰기 규칙)이 섞인 사이트 설정. 검토는 어느 부분이 "바로 저장돼요"이고 어느 부분이 "PR로 가요"인지 표시한다. 흐름 11의 단계 11, 12와 같은 검토다.

### 단계 14: "배포 · GitHub 플러그인 있음 · PR 만든 뒤 → 열린 PR 줄 · 합치고 배포하면 적용"

- 보드: `Flow11Step14.dc.html`
- 화면: `Schema` (stage "PR 만듦")
- PR을 만들고 나면 열린 PR 줄이 보인다("PR #12", 제목, "합치고 배포하면 적용돼요"). 알림이 PR을 만들었다고 알린다.

### 단계 14b: "배포 · GitHub 플러그인 있음 · PR이 열려 있는데 또 고침 → 버튼이 “PR에 더하기” (PR은 하나씩, 검토에서 그 PR에 커밋을 더함)"

- 보드: `Flow11Step14b.dc.html`
- 화면: `Schema` (stage "PR에 더하기")
- PR이 이미 열려 있는데 사용자가 다시 고친다. 버튼은 "PR에 더하기"다. PR은 한 번에 하나이고, 검토는 그 PR에 커밋을 더한다.

## "배포 · GitHub 플러그인 없음"

### 단계 15: "배포 · GitHub 플러그인 없음 · 사이트 → 미리보기 · 공개 주소만 잠김, 나머지는 고칠 수 있음"

- 보드: `Flow11Step15.dc.html`
- 화면: `Settings` (stage "읽기 전용")
- GitHub 플러그인이 없는 운영 환경. 설정 › 사이트 › 미리보기. 공개 주소만 잠기고, 나머지는 고칠 수 있다.

### 단계 15b: "배포 · GitHub 플러그인 없음 · 사이트 이름을 고침 → 버튼은 “저장” (바로 저장)"

- 보드: `Flow11Step15b.dc.html`
- 화면: `Settings` (stage "읽기 전용 저장")
- 사용자가 사이트 이름을 바꾼다. 버튼은 "저장"이고 바로 저장한다.

### 단계 16: "배포 · GitHub 플러그인 없음 · 언어 → 목록 전체가 잠김 · 시간대만 고칠 수 있음"

- 보드: `Flow11Step16.dc.html`
- 화면: `Locales` (stage "읽기 전용")
- GitHub 플러그인이 없는 운영 환경, 언어. 목록 전체가 잠기고, 시간대만 고칠 수 있다.

### 단계 17: "배포 · GitHub 플러그인 없음 · 컬렉션 → 구조만 잠김 · 보기와 속성 패널 구성은 고칠 수 있음"

- 보드: `Flow11Step17.dc.html`
- 화면: `Schema` (stage "읽기 전용")
- GitHub 플러그인이 없는 운영 환경, 컬렉션. 구조만 잠긴다. 보기와 속성 패널 구성은 고칠 수 있다.

### 단계 17b: "배포 · GitHub 플러그인 없음 · 필드를 누름 → 라벨 · 설명은 고치고 구조는 잠김"

- 보드: `Flow11Step17b.dc.html`
- 화면: `Schema` (stage "읽기 전용 필드")
- 사용자가 필드를 누른다. 라벨과 설명은 고칠 수 있고, 구조(이름, 종류, 필수, 여러 줄, 최대 길이)는 잠겨 있다.

### 단계 17c: "배포 · GitHub 플러그인 없음 · 컬렉션 · 기본 탭 → 보기는 고칠 수 있음 · 구조는 잠김"

- 보드: `Flow11Step17c.dc.html`
- 화면: `Schema` (stage "읽기 전용"; tab "기본")
- 컬렉션 기본 탭. 보기 설정(표시 이름, 폴더)은 고칠 수 있고, 구조(식별자, 종류, 공개 주소)는 잠겨 있다.

### 단계 18: "배포 · GitHub 플러그인 없음 · 관리자 → 관리자 주소만 잠김"

- 보드: `Flow11Step18.dc.html`
- 화면: `AdminSettings` (stage "읽기 전용")
- GitHub 플러그인이 없는 운영 환경, 관리자. 관리자 주소만 잠긴다.

## "예외"

### 단계 19: "예외 · 화면을 연 뒤 파일이 바뀜 → 다시 불러오기"

- 보드: `Flow11Step19.dc.html`
- 화면: `Schema` (stage "충돌")
- 예외: 화면을 연 뒤에 파일이 바뀌었다. 배너가 이 화면을 연 뒤로 monti.schema.ts가 바뀌었다고 알리고, "다시 불러오기"를 보여 준다. 아래의 검토는 사용자가 바꾼 세 곳에 대한 것이다.

### 단계 20: "예외 · 파일은 저장, 데이터베이스 적용 실패 → 다시 적용"

- 보드: `Flow11Step20.dc.html`
- 화면: `Schema` (stage "적용 실패")
- 예외: 파일은 저장했지만 데이터베이스에 적용하지 못했다. 배너가 데이터베이스에 적용하지 못했다고 알리고("파일은 저장했어요"와 오류), "다시 적용"과 "다시 불러오기"를 보여 준다.

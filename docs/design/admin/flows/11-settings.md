# Flow 11: Settings

This file lists every row and step of canvas flow 11, "흐름 11 · 설정". Dev server (no plugin, writes the file directly), production with the GitHub plugin (PR), production without a plugin (locks), and exceptions. The four settings tabs follow the same rules.

Canvas note: "흐름 11 · 설정 — 개발 서버(플러그인 없이 파일에 바로) · 배포 + GitHub 플러그인(PR) · 배포, 플러그인 없음(자물쇠) · 예외 — 네 탭이 같은 규칙"

Screens used: [`Settings`](../screens.md#settings), [`Locales`](../screens.md#locales), [`Schema`](../screens.md#schema), [`AssistantPanel`](../screens.md#assistantpanel), [`AdminSettings`](../screens.md#adminsettings).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "개발 서버 · 사이트" · Dev server, site

### Step 01: "개발 서버 · 사이트 · 다른 호스트 이름 · + 호스트 → 줄에서 바로 입력"

- Board: `Flow11Step01.dc.html`
- Renders: `Settings` (stage "호스트 추가")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Dev server, Settings › Site. In the host names row the user presses "+ 호스트" and types the new host straight into the row (placeholder blog.example.dev).

### Step 02: "개발 서버 · 사이트 · 미리보기 경로에 언어 넣기를 끔 → 미리보기 언어 쿼리 칸이 나타남 (비우면 locale)"

- Board: `Flow11Step02.dc.html`
- Renders: `Settings` (stage "언어 쿼리")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- The user turns off "put the language in the preview path". A field "미리보기 언어 쿼리" (preview language query) appears; left empty it means `locale`.

### Step 03: "개발 서버 · 사이트 · 칸 오류 · 홈 링크는 주소(/…)나 https:// → 저장 막힘"

- Board: `Flow11Step03.dc.html`
- Renders: `Settings` (stage "칸 오류")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Field error: one short line under the field, the field marked invalid, saving blocked until it is fixed. The board draws it on the home link; the site has no home link setting, so in code the same behaviour is on the host names: a host that is not a host name (like "example dev") gets "호스트 이름이 아니에요." under its row.

### Step 04: "개발 서버 · 나가려 할 때 · 저장하지 않은 바뀐 곳 → 확인 (계속 고치기 · 저장하지 않고 나가기)"

- Board: `Flow11Step04.dc.html`
- Renders: `Settings` (stage "나가기 확인")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- The user tries to leave with unsaved changes. A dialog says leaving drops the 2 changed places, with "계속 고치기" (keep editing) and "저장하지 않고 나가기" (leave without saving).

## "개발 서버 · 언어" · Dev server, languages

### Step 05: "개발 서버 · 언어 · + 언어 추가 → 코드 찾기 (맨 끝은 직접 입력)"

- Board: `Flow11Step05.dc.html`
- Renders: `Locales` (stage "언어 찾기")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Dev server, Settings › Languages. The user presses "+ 언어 추가". A code finder opens (typing zh lists zh-Hans, zh-Hant, zh-HK with native and Korean names); the last item is "직접 입력" (type it yourself).

### Step 06: "개발 서버 · 언어 · 코드를 고르면 바로 줄이 생김 · 이름은 코드에서 → 바뀐 곳에 더해짐"

- Board: `Flow11Step06.dc.html`
- Renders: `Locales` (stage "언어 추가됨")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Picking a code adds the row at once (日本語, ja, name from the code). The change is listed in the changes bar with "모두 되돌리기" and "저장하고 적용".

### Step 06b: "개발 서버 · 언어 · 직접 입력 → 이름을 한 번 묻는 작은 창"

- Board: `Flow11Step06b.dc.html`
- Renders: `Locales` (stage "직접 입력")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Choosing "직접 입력" opens a small dialog asking once for the code, the native name and the display name, with cancel and add.

### Step 07: "개발 서버 · 언어 · 원문 바꾸기 → 언어 고르기"

- Board: `Flow11Step07.dc.html`
- Renders: `Locales` (stage "원문 메뉴")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- The user opens the source-language menu ("원문 바꾸기") and the language picker opens.

### Step 07b: "개발 서버 · 언어 · 고르면 맨 위로 · 원문이 바뀜 · 두 줄에 바뀐 곳 표시 (검토를 거쳐 저장)"

- Board: `Flow11Step07b.dc.html`
- Renders: `Locales` (stage "원문 바꿈")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- After choosing, that language moves to the top and becomes the source. Two rows are marked as changed. The change still goes through review before it is saved.

### Step 08: "개발 서버 · 언어 · 번역이 있는 언어를 ×로 빼기 → 검토 · 번역 12편 남겨 두기 · 휴지통으로 (흐름 4 · 11과 같은 방식)"

- Board: `Flow11Step08.dc.html`
- Renders: `Locales` (stage "빼기 검토")
- Test: `packages/admin/src/screens/settings/__test__/settings-flows.test.tsx`
- Test: `packages/admin/src/screens/schema/__test__/collections-edit-flows.test.tsx`
- The user removes a language that has translations with ×. A review asks what happens to the 12 English translations: keep them ("남겨 두기") or move them to the trash ("휴지통으로"), noting that adding the language again brings them back. It follows the same pattern as flow 4 and flow 11 reviews. Buttons: cancel, apply.

## "배포 · GitHub 플러그인 있음" · Production, GitHub plugin present

### Step 09: "배포 · GitHub 플러그인 있음 · 사이트 이름·글 쓰는 방식 같은 관리자 설정만 고침 → 버튼이 “저장” (바로 저장)"

- Board: `Flow11Step09.dc.html`
- Renders: `Settings` (stage "운영 글 쓰는 방식")
- Production with the GitHub plugin. The user edits only admin settings, such as the site name or writing rules. The save button reads "저장" (save) and saves directly.

### Step 10: "배포 · GitHub 플러그인 있음 · 컬렉션을 고침 → 고치면 화면에 바로 · 저장 버튼은 “PR 만들기”"

- Board: `Flow11Step10.dc.html`
- Renders: `Schema` (stage "운영 고침")
- Production with the GitHub plugin. The user edits a collection (a new field "readingTime"). The change shows on screen at once and the save button reads "PR 만들기" (create PR).

### Step 11: "배포 · GitHub 플러그인 있음 · ✦ 요청 → 필드에 제안 표시"

- Board: `Flow11Step11.dc.html`
- Renders: `Schema` (stage "운영 제안"; with-rail off) + `AssistantPanel` (view "스키마 변경")
- The user asks the assistant (✦) to add a field. The field list shows the proposal marked "✦ 제안". The reply says the settings are marked and that on this site saving opens a PR.

### Step 12: "배포 · GitHub 플러그인 있음 · 검토 → 파일 변경과 함께 PR 만들기"

- Board: `Flow11Step12.dc.html`
- Renders: `Schema` (stage "운영 검토")
- Review before the PR. The review shows the change in the collection and the file change to monti.schema.ts (+5 lines, the readingTime field). Buttons: cancel, "PR 만들기".

### Step 13: "배포 · GitHub 플러그인 있음 · 사이트 · 미리보기 경로(파일)와 관리자 설정을 함께 고침 → PR 만들기 → 검토 · 바로 저장돼요 / PR로 가요 (흐름 11 · 12와 같은 검토)"

- Board: `Flow11Step13.dc.html`
- Renders: `Settings` (stage "운영 검토")
- Site settings that mix a file value (preview path, written to monti.schema.ts, +1 −1) and an admin setting (writing rules). The review marks which part "바로 저장돼요" (saves directly) and which "PR로 가요" (goes to the PR). It is the same review as in flow 11 steps 11 and 12.

### Step 14: "배포 · GitHub 플러그인 있음 · PR 만든 뒤 → 열린 PR 줄 · 합치고 배포하면 적용"

- Board: `Flow11Step14.dc.html`
- Renders: `Schema` (stage "PR 만듦")
- After the PR is created, an open PR row shows ("PR #12", title, "합치고 배포하면 적용돼요", applies once merged and deployed). A notice says the PR was created.

### Step 14b: "배포 · GitHub 플러그인 있음 · PR이 열려 있는데 또 고침 → 버튼이 “PR에 더하기” (PR은 하나씩, 검토에서 그 PR에 커밋을 더함)"

- Board: `Flow11Step14b.dc.html`
- Renders: `Schema` (stage "PR에 더하기")
- A PR is already open and the user edits again. The button reads "PR에 더하기" (add to the PR). There is one PR at a time; the review adds a commit to that PR.

## "배포 · GitHub 플러그인 없음" · Production, GitHub plugin absent

### Step 15: "배포 · GitHub 플러그인 없음 · 사이트 → 미리보기 · 공개 주소만 잠김, 나머지는 고칠 수 있음"

- Board: `Flow11Step15.dc.html`
- Renders: `Settings` (stage "읽기 전용")
- Production without the GitHub plugin. Settings › Site › Preview. Only the public address is locked; the rest is editable.

### Step 15b: "배포 · GitHub 플러그인 없음 · 사이트 이름을 고침 → 버튼은 “저장” (바로 저장)"

- Board: `Flow11Step15b.dc.html`
- Renders: `Settings` (stage "읽기 전용 저장")
- The user changes the site name. The button reads "저장" and saves directly.

### Step 16: "배포 · GitHub 플러그인 없음 · 언어 → 목록 전체가 잠김 · 시간대만 고칠 수 있음"

- Board: `Flow11Step16.dc.html`
- Renders: `Locales` (stage "읽기 전용")
- Production without the GitHub plugin, Languages. The whole list is locked; only the time zone is editable.

### Step 17: "배포 · GitHub 플러그인 없음 · 컬렉션 → 구조만 잠김 · 보기와 속성 패널 구성은 고칠 수 있음"

- Board: `Flow11Step17.dc.html`
- Renders: `Schema` (stage "읽기 전용")
- Production without the GitHub plugin, Collections. Only the structure is locked. Views and the property panel layout can be edited.

### Step 17b: "배포 · GitHub 플러그인 없음 · 필드를 누름 → 라벨 · 설명은 고치고 구조는 잠김"

- Board: `Flow11Step17b.dc.html`
- Renders: `Schema` (stage "읽기 전용 필드")
- The user clicks a field. Label and description are editable; the structure (name, kind, required, multiline, max length) is locked.

### Step 17c: "배포 · GitHub 플러그인 없음 · 컬렉션 · 기본 탭 → 보기는 고칠 수 있음 · 구조는 잠김"

- Board: `Flow11Step17c.dc.html`
- Renders: `Schema` (stage "읽기 전용"; tab "기본")
- Collection basic tab. View settings (display name, folders) are editable; the structure (identifier, kind, public address) is locked.

### Step 18: "배포 · GitHub 플러그인 없음 · 관리자 → 관리자 주소만 잠김"

- Board: `Flow11Step18.dc.html`
- Renders: `AdminSettings` (stage "읽기 전용")
- Production without the GitHub plugin, Admin. Only the admin address is locked.

## "예외" · Exceptions

### Step 19: "예외 · 화면을 연 뒤 파일이 바뀜 → 다시 불러오기"

- Board: `Flow11Step19.dc.html`
- Renders: `Schema` (stage "충돌")
- Exception: the file changed after the screen was opened. A banner says monti.schema.ts changed since this screen was opened, with "다시 불러오기" (reload). The review below is the one for the user's three changes.

### Step 20: "예외 · 파일은 저장, 데이터베이스 적용 실패 → 다시 적용"

- Board: `Flow11Step20.dc.html`
- Renders: `Schema` (stage "적용 실패")
- Exception: the file was saved but applying to the database failed. A banner says it could not apply to the database ("파일은 저장했어요", plus the error) with "다시 적용" (apply again) and "다시 불러오기".

# Flow 8: First install

This file lists every row and step of canvas flow 8, "흐름 8 · 처음 설치". The first admin and the sign-in exceptions. AI connection is flow 2 steps 22 and 23, a missing storage is flow 6, a missing GitHub plugin is flow 11 step 17.

Canvas note: "흐름 8 · 처음 설치 — 첫 관리자 · 로그인 예외 (AI 연결은 흐름 2 · 22–23, 저장소 없음은 흐름 6, GitHub 플러그인이 없을 때는 흐름 11 · 17)"

Screens used: [`Login`](../screens.md#login), [`Empty`](../screens.md#empty).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "첫 관리자" · First admin

### Step 01: "첫 관리자 · /admin 첫 방문 · 관리자가 없으면 만들기"

- Board: `Flow8Step01.dc.html`
- Renders: `Login` (attempt "첫 관리자")
- First visit to /admin when no admin exists. The screen is "첫 관리자 만들기" (create the first admin): email, password (10 or more characters), confirm password, and a create button.

### Step 02: "첫 관리자 · 칸 오류 · 10자 이상 · 두 비밀번호가 다름"

- Board: `Flow8Step02.dc.html`
- Renders: `Login` (attempt "첫 관리자 오류")
- Field errors: "10자 이상이어야 해요." (at least 10 characters) under the password and "두 비밀번호가 같지 않아요." (the two passwords differ) under the confirm field.

### Step 03: "첫 관리자 · 만들고 바로 로그인 → 빈 게시글 목록"

- Board: `Flow8Step03.dc.html`
- Renders: `Empty` (collection "게시글")
- The admin is created and signed in at once. The screen is the empty post list (no posts yet, first-post call to action "첫 글 쓰기").

### Step 04: "첫 관리자 · 그 사이 다른 곳에서 먼저 만듦 → 로그인으로"

- Board: `Flow8Step04.dc.html`
- Renders: `Login` (attempt "이미 있음")
- Exception: someone else created the first admin in the meantime. The screen says "이미 관리자가 있어요." (an admin already exists) and offers "로그인하기" (sign in).

## "로그인" · Sign in

### Step 05: "로그인 · 이메일과 비밀번호 · GitHub"

- Board: `Flow8Step05.dc.html`
- Renders: `Login` (attempt "처음")
- Sign-in: email and password, or GitHub.

### Step 06: "로그인 · 틀림"

- Board: `Flow8Step06.dc.html`
- Renders: `Login` (attempt "한 번 틀림")
- Wrong credentials. The form shows "이메일 또는 비밀번호가 맞지 않아요." (email or password is wrong).

### Step 07: "로그인 · 5번 틀리면 1분 막힘"

- Board: `Flow8Step07.dc.html`
- Renders: `Login` (attempt "잠김")
- After 5 wrong attempts sign-in is blocked for one minute: "1분 뒤에 다시 시도해 주세요."

### Step 08: "로그인 · GitHub만 쓰는 사이트"

- Board: `Flow8Step08.dc.html`
- Renders: `Login` (attempt "GitHub만")
- A site that uses GitHub only: the sign-in screen has the GitHub button and no email form.

### Step 09: "로그인 · 권한 없는 GitHub 계정"

- Board: `Flow8Step09.dc.html`
- Renders: `Login` (attempt "GitHub 권한 없음")
- A GitHub account that is not an admin: "octo-kim은 관리자가 아니에요." with "다른 계정으로 로그인" (sign in with another account).

## "예외" · Exceptions

### Step 10: "예외 · 로그인 방법이 설정되지 않음"

- Board: `Flow8Step10.dc.html`
- Renders: `Login` (attempt "로그인 없음")
- Exception: no sign-in method is configured. The screen says "로그인이 설정되지 않았어요" (sign-in is not set up).

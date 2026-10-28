# Flow 10: API keys

This file lists every row and step of canvas flow 10, "흐름 10 · API 키". Adding, checking, editing and deleting keys, plugin keys, the quick-task model, and exceptions.

Canvas note: "흐름 10 · API 키 — 추가 · 확인 · 편집 · 지우기 · 플러그인 키 · 빠른 작업 모델 · 예외"

Screens used: [`ApiKeys`](../screens.md#apikeys).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "키 추가" · Add a key

### Step 01: "키 추가 · + 키 추가 → 서비스 고르기"

- Board: `Flow10Step01.dc.html`
- Renders: `ApiKeys` (stage "서비스 고르기")
- The user presses "+ 키 추가" (add key) on Tools › API keys. A service picker opens: AI (OpenAI, OpenRouter, Google, OpenAI-compatible address, Ollama) and the first-party AI service.

### Step 02: "키 추가 · 서비스를 고른 뒤 · 이름은 서비스 이름으로 채워져 있음 · 키"

- Board: `Flow10Step02.dc.html`
- Renders: `ApiKeys` (stage "키 입력")
- After choosing the service, the add dialog shows the name already filled with the service name, and a key field (placeholder sk-ant-…) with the add button.

### Step 02b: "키 추가 · OpenAI 호환 주소 → 주소 칸이 더해짐 · 이름은 주소의 호스트로 채워짐"

- Board: `Flow10Step02b.dc.html`
- Renders: `ApiKeys` (stage "호환 주소")
- Choosing OpenAI-compatible address adds an address field. The name is filled with the host of that address.

### Step 03: "키 추가 · 추가 → 서비스에 확인하는 중…"

- Board: `Flow10Step03.dc.html`
- Renders: `ApiKeys` (stage "확인하는 중")
- The user presses add. The dialog shows "확인하는 중…" (checking with the service).

### Step 04: "키 추가 · 서비스가 받아 주지 않음 → 키 칸 아래 한 줄 · 창은 열린 채"

- Board: `Flow10Step04.dc.html`
- Renders: `ApiKeys` (stage "키 거절")
- The service does not accept the key. One line under the key field says the key is not valid ("맞지 않는 키예요."); the dialog stays open.

### Step 05: "키 추가 · 같은 이름의 키가 이미 있음 → 이름이 "Anthropic 2"로 채워짐 · 한 줄"

- Board: `Flow10Step05.dc.html`
- Renders: `ApiKeys` (stage "이름 겹침")
- A key with the same name already exists. The name is filled in as "Anthropic 2" and one line says a key with that name exists.

### Step 06: "키 추가 · 추가됨 → 목록에 새 줄 · 토스트"

- Board: `Flow10Step06.dc.html`
- Renders: `ApiKeys` (stage "추가됨")
- The key was added. A new row appears in the list (name, last four characters) and a toast says "키를 추가했어요".

## "편집" · Edit

### Step 07: "편집 · 편집 → 서비스는 글자로 · 이름 · 키는 ··· a1b2 · 바꾸기"

- Board: `Flow10Step07.dc.html`
- Renders: `ApiKeys` (stage "편집")
- The user presses edit on a key. The service shows as plain text, the name is editable, the key shows as "··· a1b2" with a "바꾸기" (change) action, and a save button.

### Step 08: "편집 · 바꾸기 → 빈 키 칸이 열림 · 그대로를 누르면 ··· a1b2로 돌아감"

- Board: `Flow10Step08.dc.html`
- Renders: `ApiKeys` (stage "편집 키 열기")
- The user presses change. An empty key field opens; "그대로" (keep) puts back "··· a1b2".

### Step 09: "편집 · 새 키 → 저장 → 확인하는 중… (03 · 04와 같은 확인, 같은 이름은 05와 같은 한 줄)"

- Board: `Flow10Step09.dc.html`
- Renders: `ApiKeys` (stage "편집 확인 중")
- The user enters a new key and saves. The dialog shows "확인하는 중…". The check is the same as in steps 03 and 04, and a duplicate name shows the same line as in step 05.

### Step 10: "편집 · 저장됨 → 줄에 새 끝자리 · 토스트"

- Board: `Flow10Step10.dc.html`
- Renders: `ApiKeys` (stage "편집 저장됨")
- Saved. The row shows the new last four characters and a toast says "저장했어요".

## "지우기" · Delete

### Step 11: "지우기 · 줄의 지우기 → 쓰는 곳이 있으면 확인에 멈추는 곳 목록 · 빨간 지우기"

- Board: `Flow10Step11.dc.html`
- Renders: `ApiKeys` (stage "지우기 확인")
- The user presses delete on a row. The confirm says it cannot be undone and that places using the key will stop; if the key is in use it lists where (assistant: claude-sonnet-5-5; quick tasks: default). The delete button is red.

### Step 11b: "지우기 · 쓰는 곳이 없어도 확인 (되돌릴 수 없음)"

- Board: `Flow10Step11b.dc.html`
- Renders: `ApiKeys` (stage "쓰는 곳 없이 지우기")
- A key that nothing uses still asks for confirmation ("되돌릴 수 없어요.").

## "플러그인 키" · Plugin keys

### Step 12: "플러그인 · 키 없음을 누름 → 저장된 키가 없어 바로 키 추가 (서비스가 골라짐)"

- Board: `Flow10Step12.dc.html`
- Renders: `ApiKeys` (stage "키 넣기")
- Plugin keys. The user clicks "키 없음" (no key) on a plugin key row (spelling check, search keys). Because no stored key exists, the add-key dialog opens right away with the service already chosen.

### Step 12b: "키 넣기 · 추가됨 → 줄에 키 이름 · 토스트"

- Board: `Flow10Step12b.dc.html`
- Renders: `ApiKeys` (stage "키 넣음")
- The key was added. The plugin row now shows the key name and a toast says the key was added to the plugin.

## "빠른 작업 모델" · Quick-task model

### Step 13: "빠른 작업 모델 · 모델 메뉴 (흐름 2의 고르기, 키마다 묶음)"

- Board: `Flow10Step13.dc.html`
- Renders: `ApiKeys` (stage "모델 고르기")
- Quick-task model. The user opens the model menu for quick tasks (summaries, tags, alt text, translation filling). It is the same picker as in flow 2: search box, models grouped by key.

### Step 13b: "빠른 작업 모델 · 고르면 바로 바뀜 · 토스트"

- Board: `Flow10Step13b.dc.html`
- Renders: `ApiKeys` (stage "모델 바뀜")
- Picking a model changes it immediately. A toast says "빠른 작업 모델을 바꿨어요" and the row shows the model.

## "예외" · Exceptions

### Step 14: "예외 · 읽을 수 없는 키 (서버 비밀값이 바뀜) → 줄마다 표시 · 편집"

- Board: `Flow10Step14.dc.html`
- Renders: `ApiKeys` (stage "읽을 수 없음")
- Exception: keys that cannot be read because the server secret changed. A banner says 3 keys cannot be read, naming the server secret MONTI_SECRET as changed. Each key row is marked "읽을 수 없어요" and has edit.

### Step 14b: "예외 · 읽을 수 없는 키 · 편집 → 키 칸에 초점 · 키를 다시 넣어 주세요 (키 필수)"

- Board: `Flow10Step14b.dc.html`
- Renders: `ApiKeys` (stage "다시 넣기")
- The user presses edit on an unreadable key. The key field is focused and the message says to enter the key again. The key is required before saving.

### Step 15: "예외 · MONTI_SECRET 없음 → 배너 · 키 추가 막힘"

- Board: `Flow10Step15.dc.html`
- Renders: `ApiKeys` (stage "비밀값 없음")
- Exception: MONTI_SECRET is not set. A banner says keys cannot be saved until the secret is set and the server restarted. Adding keys is blocked; the key counts show none and plugin rows show "키 없음".

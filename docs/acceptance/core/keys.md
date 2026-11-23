# `resources/keys/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 3.2절(`monti.withStoredKey`), 5절(`Plugin.keyServices`), 6절(`api_keys`), 7절(`keys` 리소스)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `keys.create` | 외부 서비스 키를 암호화 저장하고 원문 없이 `id`, `service`, `name`, `last4` 반환 | 암호화 `secret` 미설정·빈 문자열 `BAD_REQUEST`, 이름 중복(동시 생성 포함) `CONFLICT` |
| `keys.list` | 원문 `secret`을 제외한 키 목록을 돌려준다 | 없음 |
| `keys.update` | 키 `name`과 선택 `secret` 갱신 | 빈 문자열·`secret` 변경 시 암호화 `secret` 미설정 `BAD_REQUEST`, 미존재 `NOT_FOUND`, 이름 중복 `CONFLICT` |
| `keys.delete` | 지정한 키 삭제 | 미존재 `NOT_FOUND` |
| `keys.check` | 입력 `{ service, secret }` 또는 저장된 `{ id }`로 플러그인 `keyServices` 연결 확인 | 확인 실패·복호화 `secret` 미설정·복호화 실패 `BAD_REQUEST`, 미등록 서비스·없는 ID `NOT_FOUND` |
| `monti.withStoredKey` | 서버 코드가 저장된 키 `{ id, service }`의 복호화된 원문을 콜백 `use`로 받아 쓰고 그 결과를 돌려받는다(Operation이 아니다) | 복호화 `secret` 미설정·저장된 `service` 불일치 `BAD_REQUEST`, 없는 ID `NOT_FOUND` |

---

## 1. 생성 (`create`)

### 핵심 요구사항

<details>
<summary><strong><code>KEY-CRT-1</code></strong> 키를 암호화해 저장하고 끝 4자리를 돌려준다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: `service`, `name`, `secret`으로 `keys.create`를 실행한다
- **결과**:
  - `KEY-CRT-1.1` 반환값에 `id`, `service`, `name`이 들어 있다
  - `KEY-CRT-1.2` 반환값의 `last4`가 `secret`의 끝 4자리이다
  - `KEY-CRT-1.3` 반환값에 `secret`은 들어 있지 않다
  - `KEY-CRT-1.4` `api_keys`에 해당 `id`의 행이 하나 생긴다
  - `KEY-CRT-1.5` `api_keys`에 저장된 `secret`은 평문 `secret`과 다르다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>KEY-CRT-2</code></strong> 같은 이름의 키가 이미 있으면 새 키를 만들 수 없다</summary>

- **전제**: 키가 하나 저장되어 있다
- **행동**: 기존 키와 같은 `name`으로 `keys.create`를 실행한다
- **결과**:
  - `KEY-CRT-2.1` `CONFLICT` 오류를 던진다
  - `KEY-CRT-2.2` `api_keys`의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>KEY-CRT-3</code></strong> 암호화 비밀값이 없으면 키를 저장할 수 없다</summary>

- **전제**: 암호화 비밀값(`secret`)이 설정되지 않은 엔진이고 `api_keys`가 비어 있다
- **행동**: `service`, `name`, `secret`으로 `keys.create`를 실행한다
- **결과**:
  - `KEY-CRT-3.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-CRT-3.2` `api_keys`가 비어 있다

</details>

<details>
<summary><strong><code>KEY-CRT-4</code></strong> 서비스·이름·비밀값 중 하나라도 빈 문자열이면 키를 저장할 수 없다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: `service`, `name`, `secret` 중 하나를 빈 문자열(`""`)로 넣어 `keys.create`를 실행한다
- **결과**:
  - `KEY-CRT-4.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-CRT-4.2` `api_keys`가 비어 있다

</details>

<details>
<summary><strong><code>KEY-CRT-5</code></strong> 같은 이름으로 키를 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다</summary>

- **전제**: 암호화 비밀값(`secret`)이 설정되어 있고 `api_keys`가 비어 있다
- **행동**: 같은 `name`으로 `keys.create` 두 건을, 서로의 커밋을 보기 전에 겹치도록 동시에 실행한다
- **결과**:
  - `KEY-CRT-5.1` 한 건은 성공하고 나머지 한 건은 `CONFLICT` 오류를 던진다
  - `KEY-CRT-5.2` `api_keys` 테이블에 해당 `name`의 행이 정확히 하나만 남는다

</details>

## 2. 목록 (`list`)

<details>
<summary><strong><code>KEY-LST-1</code></strong> 저장된 키들의 원문 비밀값을 제외한 목록을 돌려준다</summary>

- **전제**: 서로 다른 키 두 개가 저장되어 있다
- **행동**: `keys.list`를 실행한다
- **결과**:
  - `KEY-LST-1.1` 두 키의 `id`, `service`, `name`, `last4` 목록을 돌려준다
  - `KEY-LST-1.2` 반환된 각 항목에 `secret`은 들어 있지 않다

</details>

## 3. 수정 (`update`)

### 핵심 요구사항

<details>
<summary><strong><code>KEY-UPD-1</code></strong> 이름과 새 비밀값을 함께 주면 이름과 키를 모두 바꾼다</summary>

- **전제**: 연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
- **행동**: 해당 `id`와 새 `name`, 새 `secret`으로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-1.1` 반환값의 `name`이 새 `name`이다
  - `KEY-UPD-1.2` 반환값의 `last4`가 새 `secret`의 끝 4자리이다
  - `KEY-UPD-1.3` `api_keys`의 `name`과 `last4`가 새 값으로 바뀐다
  - `KEY-UPD-1.4` 해당 `id`로 `keys.check`를 실행하면 연결 확인 함수가 새 `secret`으로 호출된다

</details>

<details>
<summary><strong><code>KEY-UPD-2</code></strong> 비밀값 없이 이름만 주면 이름만 바꾸고 기존 키는 유지한다</summary>

- **전제**: 연결 확인 함수를 가진 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
- **행동**: 해당 `id`와 새 `name`만으로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-2.1` 반환값의 `name`이 새 `name`이다
  - `KEY-UPD-2.2` 반환값의 `last4`는 기존 값 그대로이다
  - `KEY-UPD-2.3` `api_keys`의 `name`이 새 `name`이다
  - `KEY-UPD-2.4` 해당 `id`로 `keys.check`를 실행하면 연결 확인 함수가 기존 원문 `secret`으로 호출된다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>KEY-UPD-3</code></strong> 다른 키와 이름이 겹치면 이름을 바꿀 수 없다</summary>

- **전제**: 서로 다른 이름의 키 두 개가 저장되어 있다
- **행동**: 두 번째 키의 `id`와 첫 번째 키의 `name`으로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-3.1` `CONFLICT` 오류를 던진다
  - `KEY-UPD-3.2` 두 번째 키의 `name`은 바뀌지 않는다

</details>

<details>
<summary><strong><code>KEY-UPD-4</code></strong> 존재하지 않는 키는 수정할 수 없다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: 존재하지 않는 `id`와 새 `name`으로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-4.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>KEY-UPD-5</code></strong> 암호화 비밀값이 없으면 저장된 키의 비밀값을 바꿀 수 없다</summary>

- **전제**: 키가 하나 저장되어 있고 암호화 비밀값(`secret`)이 설정되지 않은 엔진이다
- **행동**: 저장된 키의 `id`, 새 `name`, 새 `secret`으로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-5.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-UPD-5.2` `api_keys`에서 해당 키의 `name`, `secret`, `last4`가 원래 그대로이다

</details>

<details>
<summary><strong><code>KEY-UPD-6</code></strong> 이름이나 비밀값을 빈 문자열로 바꿀 수 없다</summary>

- **전제**: 키가 하나 저장되어 있다
- **행동**: 저장된 키의 `id`와 빈 `name: ""` 또는 빈 `secret: ""`로 `keys.update`를 실행한다
- **결과**:
  - `KEY-UPD-6.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-UPD-6.2` `api_keys`에서 해당 키의 `name`, `secret`, `last4`가 원래 그대로이다

</details>

## 4. 삭제 (`delete`)

### 핵심 요구사항

<details>
<summary><strong><code>KEY-DEL-1</code></strong> 지정한 키만 지운다</summary>

- **전제**: 서로 다른 키 두 개가 저장되어 있다
- **행동**: 첫 번째 키의 `id`로 `keys.delete`를 실행한다
- **결과**:
  - `KEY-DEL-1.1` `api_keys`에 두 번째 키 하나만 남아 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>KEY-DEL-2</code></strong> 존재하지 않는 키는 지울 수 없다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: 존재하지 않는 `id`로 `keys.delete`를 실행한다
- **결과**:
  - `KEY-DEL-2.1` `NOT_FOUND` 오류를 던진다

</details>

## 5. 연결 확인 (`check`)

### 핵심 요구사항

<details>
<summary><strong><code>KEY-CHK-1</code></strong> 서비스와 비밀값으로 플러그인의 연결 확인 함수를 실행한다</summary>

- **전제**: 연결 확인 함수가 통과하는 플러그인이 등록되어 있다
- **행동**: 등록된 `service`와 `secret`으로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-1.1` 플러그인의 연결 확인 함수가 해당 `secret`으로 호출된다
  - `KEY-CHK-1.2` `{ ok: true }`를 돌려준다

</details>

<details>
<summary><strong><code>KEY-CHK-2</code></strong> 저장된 키 ID로 실행하면 비밀값을 복호화해 연결 확인 함수를 실행한다</summary>

- **전제**: 연결 확인 함수가 통과하는 플러그인이 등록되어 있고, 해당 `service`의 키가 하나 저장되어 있다
- **행동**: 저장된 키의 `id`로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-2.1` 플러그인의 연결 확인 함수가 복호화된 원문 `secret`으로 호출된다
  - `KEY-CHK-2.2` `{ ok: true }`를 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>KEY-CHK-3</code></strong> 연결 확인 함수가 실패하면 연결 확인을 거절한다</summary>

- **전제**: 연결 확인 함수가 거절하는 플러그인이 등록되어 있다
- **행동**: 등록된 `service`와 `secret`으로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-3.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>KEY-CHK-4</code></strong> 등록되지 않은 서비스의 키는 연결을 확인할 수 없다</summary>

- **전제**: 등록된 `keyServices`가 없다
- **행동**: 등록되지 않은 `service`와 `secret`으로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-4.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>KEY-CHK-5</code></strong> 존재하지 않는 키 ID로는 연결을 확인할 수 없다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: 존재하지 않는 `id`로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-5.1` `NOT_FOUND` 오류를 던진다

</details>

<details>
<summary><strong><code>KEY-CHK-6</code></strong> 암호화 비밀값이 없으면 저장된 키 ID로 연결을 확인할 수 없다</summary>

- **전제**: 키가 하나 저장되어 있고 암호화 비밀값(`secret`)이 설정되지 않은 엔진이다
- **행동**: 저장된 키의 `id`로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-6.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>KEY-CHK-7</code></strong> 저장할 때와 다른 암호화 비밀값으로는 저장된 키의 연결을 확인할 수 없다</summary>

- **전제**: 연결 확인 함수를 가진 플러그인이 등록되어 있고, 첫 번째 암호화 비밀값(`secret`)으로 저장한 키가 하나 있으며, 그와 다른 두 번째 암호화 비밀값으로 엔진이 생성되어 있다
- **행동**: 저장된 키의 `id`로 `keys.check`를 실행한다
- **결과**:
  - `KEY-CHK-7.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-CHK-7.2` 플러그인의 연결 확인 함수가 호출되지 않는다
  - `KEY-CHK-7.3` 오류의 `message`와 `details`에 저장한 키 원문과 두 암호화 비밀값이 들어 있지 않다

</details>

## 6. 저장된 키 사용 (`monti.withStoredKey`)

### 핵심 요구사항

<details>
<summary><strong><code>KEY-USE-1</code></strong> 서버 코드가 저장된 키의 원문을 받아 쓰고 그 결과를 돌려받는다</summary>

- **전제**: 암호화 비밀값(`secret`)을 주고 `startMonti`로 만든 `monti`로 키를 하나 저장했다
- **행동**: 저장된 키의 `id`와 `service`, 값을 돌려주는 콜백 `use`로 `monti.withStoredKey({ id, service }, use)`를 실행한다
- **결과**:
  - `KEY-USE-1.1` `use`가 복호화된 원문 `secret`으로 호출된다
  - `KEY-USE-1.2` `use`가 돌려준 값을 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>KEY-USE-2</code></strong> 암호화 비밀값이 없으면 저장된 키를 받아 쓸 수 없다</summary>

- **전제**: 키가 하나 저장되어 있고 암호화 비밀값(`secret`)이 설정되지 않은 엔진이다
- **행동**: 저장된 키의 `id`와 `service`로 `withStoredKey({ id, service }, use)`를 실행한다
- **결과**:
  - `KEY-USE-2.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-USE-2.2` `use`가 호출되지 않는다

</details>

<details>
<summary><strong><code>KEY-USE-3</code></strong> 존재하지 않는 키는 받아 쓸 수 없다</summary>

- **전제**: `api_keys`가 비어 있다
- **행동**: 존재하지 않는 `id`로 `withStoredKey({ id, service }, use)`를 실행한다
- **결과**:
  - `KEY-USE-3.1` `NOT_FOUND` 오류를 던진다
  - `KEY-USE-3.2` `use`가 호출되지 않는다

</details>

<details>
<summary><strong><code>KEY-USE-4</code></strong> 다른 서비스의 키로 저장된 키는 받아 쓸 수 없다</summary>

- **전제**: 키가 하나 저장되어 있다
- **행동**: 저장된 키의 `id`와, 저장된 것과 다른 `service`로 `withStoredKey({ id, service }, use)`를 실행한다
- **결과**:
  - `KEY-USE-4.1` `BAD_REQUEST` 오류를 던진다
  - `KEY-USE-4.2` `use`가 호출되지 않는다

</details>

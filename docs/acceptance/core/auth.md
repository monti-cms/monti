# `resources/admin/` · `resources/session/` 인수 조건

[`docs/refactor/core.md`](../../refactor/core.md) 6절(`admin`, `session`)과 7절(`admin`, `session` 리소스)의 인수 조건이다.

| 액션 | 하는 일 | 주요 거절 |
|---|---|---|
| `admin.create` | 최초 관리자 계정과 로그인 세션을 만든다 | 형식 오류·빈 비밀번호 `BAD_REQUEST`, 이미 존재 `CONFLICT` |
| `admin.update` | 현재 비밀번호 확인 후 이메일·비밀번호 변경 및 전체 세션 삭제 | 형식 오류·빈 비밀번호 `BAD_REQUEST`, 계정 없음·비밀번호 불일치 `UNAUTHORIZED` |
| `session.create` | 이메일·비밀번호 검증 후 세션 토큰 발급(해시·만료시각 저장) | 이메일·비밀번호 불일치 `UNAUTHORIZED` |
| `session.get` | 유효한 토큰이면 `{ admin: { id, email } }`, 만료·미존재면 `{ admin: null }` | 없음 |
| `session.delete` | 해당 토큰의 세션 행만 삭제한다 | 없음 |

---

## 1. 관리자 생성 (`admin.create`)

### 핵심 요구사항

<details>
<summary><strong><code>ADM-CRT-1</code></strong> 관리자가 없을 때 첫 관리자와 세션을 만든다</summary>

- **전제**: `admin` 테이블이 비어 있다
- **행동**: 이메일과 비밀번호로 `admin.create`를 실행한다
- **결과**:
  - `ADM-CRT-1.1` 반환값에 관리자의 `id`와 `email`이 들어 있다
  - `ADM-CRT-1.2` 반환값에 세션 `token`이 들어 있다
  - `ADM-CRT-1.3` `admin` 테이블에 해당 이메일의 행이 하나 생긴다
  - `ADM-CRT-1.4` 저장된 `password_hash`는 평문 비밀번호와 다르다
  - `ADM-CRT-1.5` 반환된 `token`으로 `session.get`을 실행하면 `{ admin: { id, email } }`을 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>ADM-CRT-2</code></strong> 관리자가 이미 있으면 새 관리자를 만들 수 없다</summary>

- **전제**: `admin.create`로 관리자가 하나 만들어져 있다
- **행동**: 다시 `admin.create`를 실행한다
- **결과**:
  - `ADM-CRT-2.1` `CONFLICT` 오류를 던진다
  - `ADM-CRT-2.2` `admin` 테이블의 행은 원래 하나 그대로이다

</details>

<details>
<summary><strong><code>ADM-CRT-3</code></strong> 이메일 형식이 맞지 않거나 비밀번호가 비어 있으면 관리자를 만들 수 없다</summary>

- **전제**: `admin` 테이블이 비어 있다
- **행동**: 이메일 형식이 아닌 문자열 또는 빈 비밀번호로 `admin.create`를 실행한다
- **결과**:
  - `ADM-CRT-3.1` `BAD_REQUEST` 오류를 던진다
  - `ADM-CRT-3.2` `admin` 테이블이 비어 있다

</details>

## 2. 관리자 수정 (`admin.update`)

### 핵심 요구사항

<details>
<summary><strong><code>ADM-UPD-1</code></strong> 현재 비밀번호가 맞으면 이메일과 비밀번호를 바꾸고 기존 세션을 모두 지운다</summary>

- **전제**: 관리자가 하나 있고, 발급된 세션이 두 개 있다
- **행동**: 맞는 현재 비밀번호와 새 이메일, 새 비밀번호로 `admin.update`를 실행한다
- **결과**:
  - `ADM-UPD-1.1` 반환값의 `email`이 새 이메일이다
  - `ADM-UPD-1.2` `session` 테이블의 기존 세션 행이 모두 삭제된다
  - `ADM-UPD-1.3` 새 이메일과 새 비밀번호로 `session.create`를 실행하면 세션 `token`을 돌려준다
  - `ADM-UPD-1.4` 새 이메일과 이전 비밀번호로 `session.create`를 실행하면 `UNAUTHORIZED` 오류를 던진다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>ADM-UPD-2</code></strong> 현재 비밀번호가 틀리면 관리자 정보를 바꿀 수 없다</summary>

- **전제**: 관리자가 하나 있다
- **행동**: 틀린 현재 비밀번호와 새 이메일, 새 비밀번호로 `admin.update`를 실행한다
- **결과**:
  - `ADM-UPD-2.1` `UNAUTHORIZED` 오류를 던진다
  - `ADM-UPD-2.2` `admin` 테이블의 이메일이 바뀌지 않는다
  - `ADM-UPD-2.3` `admin` 테이블의 `password_hash`가 바뀌지 않는다

</details>

<details>
<summary><strong><code>ADM-UPD-3</code></strong> 새 이메일 형식이 맞지 않거나 새 비밀번호가 비어 있으면 관리자 정보를 바꿀 수 없다</summary>

- **전제**: 관리자가 하나 있고 발급된 세션이 하나 있다
- **행동**: 맞는 현재 비밀번호와 이메일 형식이 아닌 문자열 또는 빈 새 비밀번호로 `admin.update`를 실행한다
- **결과**:
  - `ADM-UPD-3.1` `BAD_REQUEST` 오류를 던진다
  - `ADM-UPD-3.2` `admin` 테이블의 이메일과 `password_hash`가 바뀌지 않는다
  - `ADM-UPD-3.3` `session` 테이블의 기존 세션 행이 그대로 남아 있다

</details>

<details>
<summary><strong><code>ADM-UPD-4</code></strong> 관리자 계정이 없으면 관리자 정보를 바꿀 수 없다</summary>

- **전제**: `admin` 테이블이 비어 있다
- **행동**: 유효한 현재 비밀번호, 새 이메일, 새 비밀번호로 `admin.update`를 실행한다
- **결과**:
  - `ADM-UPD-4.1` `UNAUTHORIZED` 오류를 던진다

</details>

## 3. 세션 발급 (`session.create`)

### 핵심 요구사항

<details>
<summary><strong><code>SES-CRT-1</code></strong> 이메일과 비밀번호가 맞으면 세션을 발급한다</summary>

- **전제**: 관리자가 하나 있다
- **행동**: 맞는 이메일과 비밀번호로 `session.create`를 실행한다
- **결과**:
  - `SES-CRT-1.1` 반환값에 세션 `token`이 들어 있다
  - `SES-CRT-1.2` `session` 테이블에 원문 `token`과 다른 `token_hash`가 저장된다
  - `SES-CRT-1.3` 저장된 `expires_at`은 현재 시각보다 미래이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>SES-CRT-2</code></strong> 비밀번호가 틀리면 로그인할 수 없다</summary>

- **전제**: 관리자가 하나 있다
- **행동**: 맞는 이메일과 틀린 비밀번호로 `session.create`를 실행한다
- **결과**:
  - `SES-CRT-2.1` `UNAUTHORIZED` 오류를 던진다

</details>

<details>
<summary><strong><code>SES-CRT-3</code></strong> 등록되지 않은 이메일로는 로그인할 수 없다</summary>

- **전제**: 관리자가 하나 있다
- **행동**: 등록되지 않은 이메일과 기존 관리자의 비밀번호로 `session.create`를 실행한다
- **결과**:
  - `SES-CRT-3.1` `UNAUTHORIZED` 오류를 던진다

</details>

## 4. 세션 조회 (`session.get`)

### 핵심 요구사항

<details>
<summary><strong><code>SES-GET-1</code></strong> 유효한 토큰이면 관리자를 돌려준다</summary>

- **전제**: 관리자가 하나 있고, `session.create`로 발급받은 유효한 토큰이 있다
- **행동**: 해당 토큰으로 `session.get`을 실행한다
- **결과**:
  - `SES-GET-1.1` `{ admin: { id, email } }`을 돌려준다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>SES-GET-2</code></strong> 만료된 토큰이면 빈 결과를 돌려준다</summary>

- **전제**: 관리자가 하나 있고, `expires_at`이 과거인 세션이 있다
- **행동**: 만료된 토큰으로 `session.get`을 실행한다
- **결과**:
  - `SES-GET-2.1` `{ admin: null }`을 돌려준다

</details>

<details>
<summary><strong><code>SES-GET-3</code></strong> 존재하지 않는 토큰이면 빈 결과를 돌려준다</summary>

- **전제**: 관리자가 하나 있다
- **행동**: 존재하지 않는 토큰으로 `session.get`을 실행한다
- **결과**:
  - `SES-GET-3.1` `{ admin: null }`을 돌려준다

</details>

## 5. 세션 삭제 (`session.delete`)

<details>
<summary><strong><code>SES-DEL-1</code></strong> 해당 토큰의 세션만 지운다</summary>

- **전제**: 관리자가 하나 있고, 서로 다른 세션 두 개가 발급되어 있다
- **행동**: 첫 번째 토큰으로 `session.delete`를 실행한다
- **결과**:
  - `SES-DEL-1.1` 첫 번째 토큰으로 `session.get`을 실행하면 `{ admin: null }`을 돌려준다
  - `SES-DEL-1.2` 두 번째 토큰으로 `session.get`을 실행하면 여전히 해당 관리자를 돌려준다

</details>

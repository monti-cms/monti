# `commands/` 작업 실행 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 2절(명령 체계), 4절(범용 Operation 실행기·출력·종료 코드), 6절(`commands/`·`index.ts`)의 인수 조건이다.

| 명령 / 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `--help` · `--version` · `spec` | DB 연결 없이 도움말(인자 없는 실행 포함)·버전·`specOf(plugins)` JSON을 `stdout`에 출력한다 | 알 수 없는 리소스·작업의 `--help` 시 사용법 오류(`2`) |
| `monti <resource> <action>` | 코어·플러그인 작업을 실행해 안전한 JSON(반환값 없으면 `null`)을 `stdout`에 출력하고, 쓰기 `--dry-run`과 대화형 필수 민감 필드 숨김 입력을 처리한다 | 읽기 `--dry-run`·알 수 없는 명령·잘못된 플래그 조합 시 `2`, 비대화형 필수 민감 필드 누락·코어 오류 시 `[코드] 메시지`를 `stderr`에 출력하고 `1` |

---

## 1. 도움말 · 버전 · 명세 (`--help` · `--version` · `spec`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-OPS-1</code></strong> 전역 `--help`는 설정 파일과 DB 없이 전체 도움말을 `stdout`에 출력한다</summary>

- **전제**: 설정 파일·스키마 파일·`DATABASE_URL`이 모두 없는 빈 디렉터리 `cwd`와 `io`가 있다
- **행동**: `runCli(["--help"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-1.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-1.2` `stdout`이 `formatGlobalHelp()`와 같다
  - `CLI-OPS-1.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-2</code></strong> 인자 없이 실행하면 전체 도움말을 `stdout`에 출력한다</summary>

- **전제**: 설정 파일·스키마 파일·`DATABASE_URL`이 모두 없는 빈 디렉터리 `cwd`와 `io`가 있다
- **행동**: `runCli([], io)`를 실행한다
- **결과**:
  - `CLI-OPS-2.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-2.2` `stdout`이 `formatGlobalHelp()`와 같다
  - `CLI-OPS-2.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-3</code></strong> 플러그인이 더한 작업도 DB 없이 `--help`로 옵션을 볼 수 있다</summary>

- **전제**: 쓰기 작업(`notes.ping`)을 등록한 플러그인이 포함된 `monti.config.ts`·`monti.schema.ts`와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["notes", "ping", "--help"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-3.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-3.2` `stdout`에 `notes.ping` 입력 속성과 `--input`, `--dry-run` 안내가 들어 있다
  - `CLI-OPS-3.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-4</code></strong> `--version`은 설정 파일과 DB 없이 패키지 버전을 `stdout`에 출력한다</summary>

- **전제**: 빈 디렉터리 `cwd`와 `DATABASE_URL`이 없는 `io`가 있다
- **행동**: `runCli(["--version"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-4.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-4.2` `stdout`이 `packages/cli/package.json`의 `version` 문자열이다
  - `CLI-OPS-4.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-5</code></strong> `spec`은 DB 없이 코어와 플러그인의 작업 명세를 JSON으로 출력한다</summary>

- **전제**: 플러그인이 등록된 `monti.config.ts`·`monti.schema.ts`와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["spec"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-5.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-5.2` `stdout`을 파싱한 JSON이 `specOf(config.plugins)`와 같다
  - `CLI-OPS-5.3` `stderr`가 비어 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-OPS-6</code></strong> 알 수 없는 리소스나 작업의 `--help`는 사용법 오류로 거절한다</summary>

- **전제**: `monti.config.ts`·`monti.schema.ts`가 있는 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["no_such_resource", "--help"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-6.1` 반환 종료 코드가 `2`이다
  - `CLI-OPS-6.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-OPS-6.3` `stdout`이 비어 있다

</details>

## 2. 범용 Operation 실행 (`monti <resource> <action>`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-OPS-7</code></strong> 플러그인이 등록한 작업을 실행해 결과를 순수 JSON으로 출력한다</summary>

- **전제**: 쓰기 작업(`notes.ping`)을 등록한 플러그인이 포함된 프로젝트와 실제 PostgreSQL `DATABASE_URL`이 준비되어 있다
- **행동**: `runCli(["notes", "ping", "--text", "hi"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-7.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-7.2` `stdout`을 파싱한 JSON이 플러그인 작업의 반환값과 같다
  - `CLI-OPS-7.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-8</code></strong> 반환값이 없는 작업을 실행하면 변경을 적용하고 `stdout`에 `null`을 출력한다</summary>

- **전제**: API 키 하나(`keyId`)가 저장된 DB와 유효한 프로젝트가 있다
- **행동**: `runCli(["keys", "delete", "--id", keyId], io)`를 실행한다
- **결과**:
  - `CLI-OPS-8.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-8.2` `stdout`을 파싱한 JSON이 `null`이다
  - `CLI-OPS-8.3` DB의 `api_keys` 테이블에서 해당 키가 삭제되어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-9</code></strong> 함수나 순환 참조가 섞인 설정 객체도 비순환 공유 참조와 직렬화 가능한 값을 보존하며 JSON으로 출력한다</summary>

- **전제**: 함수, 자기 자신에 대한 순환 참조 속성, 두 경로가 함께 가리키는 공유 객체와 `name: "custom"`을 가진 플러그인을 등록한 프로젝트와 유효한 `DATABASE_URL`이 있다
- **행동**: `runCli(["config", "get"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-9.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-9.2` `stdout`을 파싱한 JSON에 설정의 `name`과 공유 객체 값이 두 경로 모두 보존되어 있다
  - `CLI-OPS-9.3` `stdout`을 파싱한 JSON의 `plugins`에 `"custom"` 이름이 보존되어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-10</code></strong> 쓰기 작업에 `--dry-run`을 붙이면 개발 설정에서도 테이블 동기화나 저장 없이 결과만 출력한다</summary>

- **전제**: 코어 마이그레이션이 적용된 DB(`posts` 테이블은 없음), `config.dev: true`와 `posts` 컬렉션이 정의된 프로젝트, `DATABASE_URL`이 있다
- **행동**: `runCli(["folders", "create", "--scope", "posts", "--name", "시험", "--dry-run"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-10.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-10.2` `stdout`을 파싱한 JSON에 `name: "시험"` 폴더가 들어 있다
  - `CLI-OPS-10.3` DB의 `folders` 테이블에 그 폴더가 없고 `posts` 테이블도 새로 생기지 않는다

</details>

<details>
<summary><strong><code>CLI-OPS-11</code></strong> 대화형 터미널에서 필수 민감 필드가 빠지면 숨김 입력으로 받아 실행한다</summary>

- **전제**: 유효한 프로젝트, `DATABASE_URL`·`MONTI_SECRET`이 설정된 환경, `isTTY: true`이고 `promptSecret`이 `"sk-test-9876"`을 돌려주는 `io`가 있다
- **행동**: `secret`을 생략해 `runCli(["keys", "create", "--service", "openai", "--name", "main"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-11.1` `promptSecret`이 `"secret"`으로 1회 호출된다
  - `CLI-OPS-11.2` 반환 종료 코드가 `0`이다
  - `CLI-OPS-11.3` `api_keys`에 새로 생긴 행의 `last4`가 `"9876"`이다

</details>

<details>
<summary><strong><code>CLI-OPS-12</code></strong> 선택 민감 필드는 대화형 터미널에서도 숨김 입력을 묻지 않는다</summary>

- **전제**: API 키 하나(`keyId`)가 저장된 DB, `MONTI_SECRET`이 설정된 환경, `isTTY: true`인 `io`가 있다
- **행동**: `secret`을 생략해 `runCli(["keys", "update", "--id", keyId, "--name", "renamed"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-12.1` `promptSecret`이 호출되지 않는다
  - `CLI-OPS-12.2` 반환 종료 코드가 `0`이다
  - `CLI-OPS-12.3` `api_keys` 테이블에서 해당 키의 `name`이 `"renamed"`로 바뀐다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-OPS-13</code></strong> 비대화형 터미널에서 필수 민감 필드가 빠지면 숨김 입력을 묻지 않고 거절한다</summary>

- **전제**: 유효한 프로젝트, `DATABASE_URL`·`MONTI_SECRET`이 설정된 환경, `isTTY: false`인 `io`가 있다
- **행동**: `secret`을 생략해 `runCli(["keys", "create", "--service", "openai", "--name", "main"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-13.1` `promptSecret`이 호출되지 않는다
  - `CLI-OPS-13.2` 반환 종료 코드가 `1`이다
  - `CLI-OPS-13.3` `stderr`가 `"[BAD_REQUEST] "`로 시작한다

</details>

<details>
<summary><strong><code>CLI-OPS-14</code></strong> 읽기 작업에 `--dry-run`을 붙이면 DB를 열지 않고 사용법 오류로 거절한다</summary>

- **전제**: `posts` 컬렉션이 정의된 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["folders", "list", "--scope", "posts", "--dry-run"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-14.1` 반환 종료 코드가 `2`이다
  - `CLI-OPS-14.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-OPS-14.3` `stdout`이 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-15</code></strong> 알 수 없는 명령은 사용법 오류로 거절한다</summary>

- **전제**: 유효한 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["unknown-cmd"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-15.1` 반환 종료 코드가 `2`이다
  - `CLI-OPS-15.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-OPS-15.3` `stdout`이 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-16</code></strong> `--input`과 개별 플래그를 함께 주면 사용법 오류로 거절한다</summary>

- **전제**: `posts` 컬렉션이 정의된 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["folders", "list", "--input", '{"scope":"posts"}', "--scope", "posts"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-16.1` 반환 종료 코드가 `2`이다
  - `CLI-OPS-16.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-OPS-16.3` `stdout`이 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-17</code></strong> 작업이 코어 오류로 거절되면 이유를 `[코드] 메시지` 형식으로 `stderr`에 출력한다</summary>

- **전제**: 코어 마이그레이션이 적용된 실제 PostgreSQL `DATABASE_URL`과 유효한 프로젝트가 준비되어 있다
- **행동**: 존재하지 않는 ID로 `runCli(["keys", "delete", "--id", "missing-key-id"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-17.1` 반환 종료 코드가 `1`이다
  - `CLI-OPS-17.2` `stderr`가 `"[NOT_FOUND] "`로 시작하고 뒤에 오류 메시지가 이어진다
  - `CLI-OPS-17.3` `stdout`이 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-18</code></strong> 작업 이름 없이 리소스 이름만 실행하면 그 리소스의 도움말을 `stdout`에 출력한다</summary>

- **전제**: 유효한 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["folders"], io)`를 실행한다
- **결과**:
  - `CLI-OPS-18.1` 반환 종료 코드가 `0`이다
  - `CLI-OPS-18.2` `stdout`에 `folders` 리소스의 작업 목록(`list`, `create`, `update`)이 들어 있다
  - `CLI-OPS-18.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-OPS-19</code></strong> `anyOf` 분기 중 `id`로 선택된 `keys.check`에서는 대화형 터미널에서도 다른 분기의 `secret`을 묻지 않는다</summary>

- **전제**: 저장된 API 키(`keyId`)와 확인 서비스 플러그인이 있는 프로젝트, `MONTI_SECRET`·`DATABASE_URL`이 설정된 환경, `isTTY: true`인 `io`가 있다
- **행동**: `runCli(["keys", "check", "--id", keyId], io)`를 실행한다
- **결과**:
  - `CLI-OPS-19.1` `promptSecret`이 호출되지 않는다
  - `CLI-OPS-19.2` 반환 종료 코드가 `0`이다

</details>

<details>
<summary><strong><code>CLI-OPS-20</code></strong> `spec --dry-run`이나 오타 옵션을 붙인 작업은 DB를 열지 않고 사용법 오류로 거절한다</summary>

- **전제**: `posts` 컬렉션이 정의된 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["spec", "--dry-run"], io)`와 `runCli(["folders", "list", "--scoep", "posts"], io)`를 각각 실행한다
- **결과**:
  - `CLI-OPS-20.1` 두 호출 모두 반환 종료 코드가 `2`이다
  - `CLI-OPS-20.2` 두 호출 모두 `stderr`에 오류 메시지가 출력되고 `stdout`이 비어 있다

</details>

# `commands/` 도구 명령 · `bin.mjs` 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 2절(명령 체계), 5절(`monti migrate`), 6절(`commands/`·`bin.mjs`)의 인수 조건이다. 대화형 TTY 숨김 프롬프트의 터미널 에코 차단은 가상 터미널(PTY) 제약으로 수동 확인 대상이다.

| 명령 / 파일 | 하는 일 | 주요 거절 |
|---|---|---|
| `monti migrate generate` | DB 연결 없이 스냅샷과 스키마 차이로 SQL 파일을 생성하고, `--dry-run` 시 `{ sql }` JSON을, 변경 없음 시 `stdout` `null`과 `stderr` 안내를 출력한다 | 잘못된 스키마 시 실행 오류(`1`) |
| `monti migrate up` · `status` | `up`은 대상 DB 정보(비밀번호 제외)를 `stderr`에 출력한 뒤 미적용 SQL을 적용(`--dry-run`은 빈 DB에도 무변경), `status`는 `migrations` 테이블 생성 없이 상태 JSON을 출력하며 `migrate --help`는 전체 도움말을 출력한다 | 개발 설정 `up`·SQL 오류 시 `1` |
| `monti clean-files` | 만료된 임시 파일을 저장소와 DB에서 제거하고 `stdout`에 `null`을 출력한다 | `storage` 미설정 시 `1`, `--dry-run` 시 `2` |
| `bin.mjs` | 실제 프로세스 진입점에서 `.env.local`·`.env` 값을 `process.env`에 채우고 단일 `jiti` 로더와 표준 입력(`--input -`) 파이프를 연결해 명령을 실행한다 | 오류 시 `process.exitCode` 반영 |

---

## 1. 마이그레이션 명령 (`migrate generate` · `up` · `status`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-TLS-1</code></strong> `migrate generate`는 DB 없이 SQL 파일과 스냅샷을 만들고 결과를 JSON으로 출력한다</summary>

- **전제**: `posts` 컬렉션이 정의된 `monti.config.ts`·`monti.schema.ts`와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["migrate", "generate", "init"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-1.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-1.2` `migrations/0001_init.sql`과 `migrations/_snapshot.json`이 생성된다
  - `CLI-TLS-1.3` `stdout`을 파싱한 JSON에 `filename: "0001_init.sql"`과 비어 있지 않은 `sql` 문자열이 들어 있다

</details>

<details>
<summary><strong><code>CLI-TLS-2</code></strong> `migrate generate --dry-run`은 파일을 쓰지 않고 `{ sql }` JSON만 출력한다</summary>

- **전제**: `posts` 컬렉션이 정의된 `monti.config.ts`·`monti.schema.ts`, `migrations` 폴더가 없는 `cwd`, `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["migrate", "generate", "--dry-run"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-2.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-2.2` `stdout`을 파싱한 JSON의 키가 `["sql"]`뿐이고 `sql` 문자열이 비어 있지 않다
  - `CLI-TLS-2.3` `migrations` 폴더에 `.sql` 파일과 `_snapshot.json`이 생기지 않는다

</details>

<details>
<summary><strong><code>CLI-TLS-3</code></strong> 스키마 변경이 없을 때 `migrate generate`는 `stdout`에 `null`, `stderr`에 변경 없음 안내를 출력한다</summary>

- **전제**: 현재 `monti.schema.ts`와 같은 스냅샷이 `migrations/_snapshot.json`에 이미 저장되어 있다
- **행동**: `runCli(["migrate", "generate"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-3.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-3.2` `stdout`을 파싱한 JSON이 `null`이다
  - `CLI-TLS-3.3` `stderr`에 변경 사항이 없다는 안내가 출력된다

</details>

<details>
<summary><strong><code>CLI-TLS-4</code></strong> `migrate up`은 비밀번호를 가린 대상 DB 정보를 `stderr`에 출력하고 미적용 SQL을 적용한다</summary>

- **전제**: 운영 설정(`config.dev: false`) 프로젝트, 호스트와 가짜 비밀번호가 담긴 `DATABASE_URL`, 미적용 `0001_init.sql`이 있다
- **행동**: `runCli(["migrate", "up"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-4.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-4.2` `stderr`에 대상 DB 호스트와 이름이 출력된다
  - `CLI-TLS-4.3` `stderr`에 비밀번호 문자열이 포함되지 않는다
  - `CLI-TLS-4.4` `stdout`을 파싱한 JSON이 `["0001_init.sql"]`이다
  - `CLI-TLS-4.5` DB에 `posts` 테이블이 생성된다

</details>

<details>
<summary><strong><code>CLI-TLS-5</code></strong> `migrate up --dry-run`은 시험 실행 결과를 JSON으로 출력하되 빈 DB에도 변경을 남기지 않는다</summary>

- **전제**: 비어 있는 DB, 운영 설정(`config.dev: false`) 프로젝트, 코어 `folders(id)`를 참조하는 미적용 `0001_init.sql`이 있다
- **행동**: `runCli(["migrate", "up", "--dry-run"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-5.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-5.2` `stdout`을 파싱한 JSON이 `["0001_init.sql"]`이다
  - `CLI-TLS-5.3` DB에 `posts`와 `migrations` 테이블이 모두 없다

</details>

<details>
<summary><strong><code>CLI-TLS-6</code></strong> `migrate status`는 `migrations` 테이블을 만들지 않고 파일별 적용 여부를 JSON으로 출력한다</summary>

- **전제**: 비어 있는 DB, 유효한 프로젝트, `0001_init.sql`이 있는 디렉터리가 있다
- **행동**: `runCli(["migrate", "status"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-6.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-6.2` `stdout`을 파싱한 JSON이 `[{ name: "0001_init.sql", applied: false }]`이다
  - `CLI-TLS-6.3` DB에 `migrations` 테이블이 없다

</details>

<details>
<summary><strong><code>CLI-TLS-7</code></strong> `migrate --help`는 전체 도움말을 `stdout`에 출력한다</summary>

- **전제**: 빈 디렉터리 `cwd`와 `DATABASE_URL`이 없는 `io`가 있다
- **행동**: `runCli(["migrate", "--help"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-7.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-7.2` `stdout`이 `formatGlobalHelp()`와 같다
  - `CLI-TLS-7.3` `stderr`가 비어 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-TLS-8</code></strong> 개발 서버 설정으로 `migrate up`을 실행하면 DB를 건드리지 않고 거절한다</summary>

- **전제**: 비어 있는 DB, `posts` 컬렉션이 정의된 `config.dev: true` 설정 프로젝트, 미적용 `0001_init.sql`, 실제 PostgreSQL `DATABASE_URL`이 있다
- **행동**: `runCli(["migrate", "up"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-8.1` 반환 종료 코드가 `1`이다
  - `CLI-TLS-8.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-TLS-8.3` `stdout`이 비어 있다
  - `CLI-TLS-8.4` DB에 `migrations`와 `posts` 테이블이 모두 없다

</details>

<details>
<summary><strong><code>CLI-TLS-9</code></strong> `migrate up` 중 일반 SQL 오류가 나면 코어 코드 접두 없이 `stderr`에 출력하고 실행 오류로 끝난다</summary>

- **전제**: 운영 설정(`config.dev: false`) 프로젝트와 SQL 문법 오류가 담긴 `0001_bad.sql`, 실제 PostgreSQL `DATABASE_URL`이 있다
- **행동**: `runCli(["migrate", "up"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-9.1` 반환 종료 코드가 `1`이다
  - `CLI-TLS-9.2` `stderr`가 비어 있지 않고 `"[42601]"` 같은 DB 오류 코드 접두를 붙이지 않는다
  - `CLI-TLS-9.3` `stdout`이 비어 있다

</details>

## 2. 임시 파일 정리 (`clean-files`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-TLS-10</code></strong> `clean-files`는 만료된 임시 파일을 저장소와 DB에서 제거하고 `stdout`에 `null`을 출력한다</summary>

- **전제**: `storage` 어댑터가 설정된 프로젝트와 만료된 `loose_files` 행이 저장된 DB가 있다
- **행동**: `runCli(["clean-files"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-10.1` 반환 종료 코드가 `0`이다
  - `CLI-TLS-10.2` `stdout`을 파싱한 JSON이 `null`이다
  - `CLI-TLS-10.3` 저장소 어댑터의 `remove`가 해당 키로 호출되고 DB에서 만료 행이 삭제된다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-TLS-11</code></strong> `storage`가 설정되지 않았으면 `clean-files`를 거절한다</summary>

- **전제**: `storage`가 없는 프로젝트와 실제 PostgreSQL `DATABASE_URL`이 있다
- **행동**: `runCli(["clean-files"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-11.1` 반환 종료 코드가 `1`이다
  - `CLI-TLS-11.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-TLS-11.3` `stdout`이 비어 있다

</details>

<details>
<summary><strong><code>CLI-TLS-12</code></strong> `--dry-run`을 지원하지 않는 `clean-files`에 `--dry-run`을 붙이면 DB를 열지 않고 사용법 오류로 거절한다</summary>

- **전제**: 유효한 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["clean-files", "--dry-run"], io)`를 실행한다
- **결과**:
  - `CLI-TLS-12.1` 반환 종료 코드가 `2`이다
  - `CLI-TLS-12.2` `stderr`에 오류 메시지가 출력된다
  - `CLI-TLS-12.3` `stdout`이 비어 있다

</details>

## 3. 실행 파일 진입점 (`bin.mjs`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-TLS-13</code></strong> `bin.mjs`는 표준 입력(`--input -`)으로 전달된 JSON을 읽어 명령을 실행하고 결과를 `stdout`에 출력한다</summary>

- **전제**: `posts` 컬렉션이 정의된 프로젝트(`monti.config.ts`·`monti.schema.ts`가 공통 모듈을 함께 import)와 실제 PostgreSQL `DATABASE_URL`이 있다
- **행동**: 자식 프로세스로 `node packages/cli/src/bin.mjs folders create --input -`를 실행하며 표준 입력에 `{"scope":"posts","name":"파이프"}`를 전달한다
- **결과**:
  - `CLI-TLS-13.1` 자식 프로세스 종료 코드가 `0`이다
  - `CLI-TLS-13.2` `stdout`을 파싱한 JSON에 `name: "파이프"` 폴더가 들어 있다
  - `CLI-TLS-13.3` `stderr`가 비어 있다

</details>

<details>
<summary><strong><code>CLI-TLS-14</code></strong> `bin.mjs`는 작업 디렉터리의 `.env` 값을 `process.env`에 채워 설정 파일에서도 읽히게 한다</summary>

- **전제**: `.env`에 `SITE_NAME="env-blog"`가 적혀 있고, `monti.config.ts`가 `name: process.env.SITE_NAME ?? "fallback"`을 내보내는 프로젝트와 실제 PostgreSQL `DATABASE_URL`이 있다
- **행동**: 자식 프로세스로 `node packages/cli/src/bin.mjs config get`을 실행한다
- **결과**:
  - `CLI-TLS-14.1` 자식 프로세스 종료 코드가 `0`이다
  - `CLI-TLS-14.2` `stdout`을 파싱한 JSON의 `name`이 `"env-blog"`이다

</details>

<details>
<summary><strong><code>CLI-TLS-15</code></strong> `migrate`·`clean-files`에 오타 옵션·남는 인자나 `migrate status --dry-run`을 주면 DB를 열지 않고 사용법 오류로 거절한다</summary>

- **전제**: 유효한 프로젝트와 `DATABASE_URL`이 비어 있는 `io`가 있다
- **행동**: `runCli(["migrate", "up", "--dry-rnu"], io)`, `runCli(["migrate", "status", "--dry-run"], io)`, `runCli(["clean-files", "extra"], io)`를 각각 실행한다
- **결과**:
  - `CLI-TLS-15.1` 세 호출 모두 반환 종료 코드가 `2`이다
  - `CLI-TLS-15.2` 세 호출 모두 `stderr`에 오류 메시지가 출력되고 `stdout`이 비어 있다

</details>

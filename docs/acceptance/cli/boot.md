# `boot/` 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 3절(프로젝트 부팅과 환경 변수), 6절(`boot/`)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `loadEnv` | 작업 디렉터리의 `.env.local`·`.env`를 Node 24 내장 `util.parseEnv`로 읽어 `기존 env > .env.local > .env` 우선순위로 합친 환경 변수를 돌려준다(파일이 없으면 기존 환경 유지) | 없음 |
| `loadProjectFiles` | `jiti`로 `monti.config.ts`와 `monti.schema.ts`의 `default` export와 해석된 절대 경로를 불러온다 | 설정·스키마 파일 없음, `default` export 없음 시 실행 오류(`exitCode: 1`) |
| `withDb` · `withMonti` | `DATABASE_URL`(필수)로 `pg` + `Kysely` 연결을 열고, `withMonti`는 `MONTI_SECRET`(선택)을 넘겨 `startMonti`로 엔진을 조립한 뒤 정상·실패와 무관하게 연결을 닫는다 | `DATABASE_URL` 없음 시 실행 오류(`exitCode: 1`) |

---

## 1. 환경 변수 로딩 (`loadEnv`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-BOOT-1</code></strong> `.env.local`과 `.env`를 읽을 때 기존 환경 변수 > `.env.local` > `.env` 순으로 우선 적용한다</summary>

- **전제**: `A="from-env"`가 담긴 `env` 객체와, `A="from-local"`·`B="from-local"`이 담긴 `.env.local`, `B="from-dot"`·`C="from-dot"`이 담긴 `.env`가 있는 임시 디렉터리 `cwd`가 있다
- **행동**: `loadEnv(cwd, env)`를 실행한다
- **결과**:
  - `CLI-BOOT-1.1` 돌려준 환경 변수에서 `A`가 `"from-env"`이다
  - `CLI-BOOT-1.2` 돌려준 환경 변수에서 `B`가 `"from-local"`이다
  - `CLI-BOOT-1.3` 돌려준 환경 변수에서 `C`가 `"from-dot"`이다

</details>

<details>
<summary><strong><code>CLI-BOOT-2</code></strong> `.env.local`과 `.env` 파일이 없어도 기존 환경 변수를 그대로 사용한다</summary>

- **전제**: `.env.local`과 `.env`가 없는 빈 임시 디렉터리 `cwd`와 `DATABASE_URL="postgres:///test"`가 담긴 `env` 객체가 있다
- **행동**: `loadEnv(cwd, env)`를 실행한다
- **결과**:
  - `CLI-BOOT-2.1` 돌려준 환경 변수에 `DATABASE_URL`이 `"postgres:///test"`로 들어 있다

</details>

## 2. 설정·스키마 파일 로딩 (`loadProjectFiles`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-BOOT-3</code></strong> `monti.config.ts`와 `monti.schema.ts`의 `default` export와 해석된 절대 경로를 불러온다</summary>

- **전제**: 유효한 `default` export를 가진 `monti.config.ts`와 `monti.schema.ts`가 있는 임시 디렉터리 `cwd`가 있다
- **행동**: `loadProjectFiles({ cwd, configPath: "./monti.config.ts", schemaPath: "./monti.schema.ts" })`를 실행한다
- **결과**:
  - `CLI-BOOT-3.1` 반환값의 `config`가 설정 파일의 `default` export와 같다
  - `CLI-BOOT-3.2` 반환값의 `schema`가 스키마 파일의 `default` export와 같다
  - `CLI-BOOT-3.3` 반환값의 `configFile`이 `cwd`와 `configPath`를 합친 절대 경로와 같다
  - `CLI-BOOT-3.4` 반환값의 `schemaFile`이 `cwd`와 `schemaPath`를 합친 절대 경로와 같다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-BOOT-4</code></strong> `monti.config.ts` 파일이 없으면 거절한다</summary>

- **전제**: `monti.schema.ts`만 있고 `monti.config.ts`가 없는 임시 디렉터리 `cwd`가 있다
- **행동**: `loadProjectFiles({ cwd, configPath: "./monti.config.ts", schemaPath: "./monti.schema.ts" })`를 실행한다
- **결과**:
  - `CLI-BOOT-4.1` 실행 오류(`exitCode: 1`)를 던진다

</details>

<details>
<summary><strong><code>CLI-BOOT-5</code></strong> `monti.schema.ts` 파일이 없으면 거절한다</summary>

- **전제**: `monti.config.ts`만 있고 `monti.schema.ts`가 없는 임시 디렉터리 `cwd`가 있다
- **행동**: `loadProjectFiles({ cwd, configPath: "./monti.config.ts", schemaPath: "./monti.schema.ts" })`를 실행한다
- **결과**:
  - `CLI-BOOT-5.1` 실행 오류(`exitCode: 1`)를 던진다

</details>

<details>
<summary><strong><code>CLI-BOOT-6</code></strong> 설정 파일이나 스키마 파일에 `default` export가 없으면 거절한다</summary>

- **전제**: `default` export 없이 이름 있는 export만 있는 `monti.config.ts`와 정상 `monti.schema.ts`가 있는 임시 디렉터리 `cwd`가 있다
- **행동**: `loadProjectFiles({ cwd, configPath: "./monti.config.ts", schemaPath: "./monti.schema.ts" })`를 실행한다
- **결과**:
  - `CLI-BOOT-6.1` 실행 오류(`exitCode: 1`)를 던진다

</details>

## 3. DB 연결과 코어 시작 (`withDb` · `withMonti`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-BOOT-7</code></strong> `MONTI_SECRET` 없이도 DB에 연결해 실행하고 끝나면 연결을 닫는다</summary>

- **전제**: 실제 PostgreSQL의 `DATABASE_URL`만 있고 `MONTI_SECRET`은 없는 `env`와 유효한 프로젝트(`project`)가 있다
- **행동**: `withMonti({ project, env }, async ({ monti, db }) => ...)` 안에서 `folders.create`를 실행하고, 종료 후 콜백이 받은 `db`로 쿼리를 시도한다
- **결과**:
  - `CLI-BOOT-7.1` 콜백 안에서 `folders.create`가 성공해 폴더가 생성된다
  - `CLI-BOOT-7.2` `withMonti`가 끝난 뒤 콜백이 받은 `db`로 쿼리하면 연결이 닫혀 오류가 난다

</details>

<details>
<summary><strong><code>CLI-BOOT-8</code></strong> `MONTI_SECRET`이 있으면 암호화 키 작업에 전달된다</summary>

- **전제**: `DATABASE_URL`과 `MONTI_SECRET`이 모두 설정된 `env`와 유효한 프로젝트(`project`)가 있다
- **행동**: `withMonti({ project, env }, async ({ monti }) => ...)` 안에서 `keys.create`를 실행한다
- **결과**:
  - `CLI-BOOT-8.1` `keys.create`가 성공해 `api_keys` 테이블에 행이 생긴다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-BOOT-9</code></strong> `DATABASE_URL`이 없으면 DB 연결을 거절한다</summary>

- **전제**: `DATABASE_URL`이 비어 있는 `env`가 있다
- **행동**: `withDb(env, async () => ...)`를 실행한다
- **결과**:
  - `CLI-BOOT-9.1` 실행 오류(`exitCode: 1`)를 던진다

</details>

<details>
<summary><strong><code>CLI-BOOT-10</code></strong> 실행 중 오류가 나도 오류를 그대로 전달하고 DB 연결을 닫는다</summary>

- **전제**: 유효한 `DATABASE_URL`이 담긴 `env`와 유효한 프로젝트(`project`)가 있다
- **행동**: `withMonti({ project, env }, async ({ db }) => ...)` 콜백 안에서 `db`를 기록한 뒤 오류를 던진다
- **결과**:
  - `CLI-BOOT-10.1` 콜백이 던진 오류가 그대로 던져진다
  - `CLI-BOOT-10.2` 예외 종료 뒤 콜백이 받은 `db`로 쿼리하면 연결이 닫혀 오류가 난다

</details>

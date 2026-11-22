# `@monti-cms/cli` 개발 기준

이 문서는 `@monti-cms/cli`(`packages/cli`)를 개발할 때 따르는 기준이다. `core`에서 분리한 CLI 이관 기록은 [plugins-and-cli.md](plugins-and-cli.md)에 있고, core의 계약은 [core.md](core.md)를 따른다.

## 1. 경계와 원칙

판단 기준은 하나다. **"터미널에서 Monti 프로젝트를 부팅하고 Operation·마이그레이션·정리 작업을 실행하는 데 필요한가?"**

**cli가 하는 일**
- **프로젝트 부팅**: 현재 작업 디렉터리에서 `.env.local`·`.env`(Node 24 내장 `util.parseEnv`, 우선순위 `기존 env > .env.local > .env`), `monti.config.ts`, `monti.schema.ts`(`default` export)를 `jiti` 단일 로더로 읽어 PostgreSQL(`pg` + `Kysely`) 연결을 열고 순수 조립 함수 `startMonti`로 엔진을 조립한 뒤, 명령이 끝나면 DB 연결을 정리한다. DB 마이그레이션(`migrateMonti` + 프로젝트 SQL)은 오직 `monti migrate up`만 실행한다.
- **범용 Operation 실행기 (`monti <resource> <action>`)**: `specOf(plugins)`로 DB 연결 없이도 도움말·명세를 보여 주고, 실행 시 코어·플러그인의 모든 Operation을 호출한다. `--input` JSON·단순 스칼라 플래그 파싱, 필수 비밀값 숨김 프롬프트, `--dry-run`, JSON 출력, 종료 코드 매핑을 담당한다.
- **운영 마이그레이션 도구 (`monti migrate`)**: `core`가 공개하는 `snapshotOf`·`planSchemaDiff`·`migrate`·`coreMigrations`를 그대로 사용해 `migrations/_snapshot.json`(DB 테이블·컬럼 스펙 스냅샷)과 현재 `monti.schema.ts`를 비교해 순수 SQL 마이그레이션 파일(`migrations/0001_<name>.sql`)을 생성하고, 운영 DB에 적용(`up`)하거나 상태(`status`)를 조회한다.
- **임시 파일 정리 (`monti clean-files`)**: `core`의 `removeLooseFiles({ db, storage })`를 CLI에서 실행한다.

**cli가 하지 않는 일**
- 도메인 검증·트랜잭션·암호화·스키마 SQL 비교 규칙 재구현(모두 `@monti-cms/core`에 위임한다).
- HTTP 서버·쿠키·관리 화면(`next`, `admin`).
- 2단계로 미루는 작업: `monti init`, `monti doctor`, `export/import`, `monti batch`(다건 트랜잭션 실행), TypeScript 형식 마이그레이션 생성(`--format ts`).

## 2. 명령 체계

```text
monti <command> [options]

전역 옵션 (모든 명령 공통)
  --config <path>       설정 파일 경로 (기본: ./monti.config.ts)
  --schema <path>       스키마 파일 경로 (기본: ./monti.schema.ts)
  --migrations <dir>    마이그레이션 폴더 경로 (기본: ./migrations)
  --help, -h            도움말 출력
  --version, -v         버전 출력
```

| 명령 | DB 연결 | 하는 일 |
|---|---|---|
| `monti --help` / `monti <resource> --help` / `monti <resource> <action> --help` | **불필요** | 전역 도움말 또는 `specOf(plugins)` 기반 리소스·액션별 옵션 도움말 출력 |
| `monti spec` | **불필요** | `specOf(plugins)` 결과를 JSON으로 출력 |
| `monti <resource> <action> [options]` | 필요 | 코어·플러그인 Operation 실행 (`--input` JSON 또는 스칼라 플래그, 쓰기 전용 `--dry-run`) |
| `monti migrate generate [name] [--dry-run]` | **불필요** | `migrations/_snapshot.json` ↔ 현재 `monti.schema.ts` 비교 후 SQL 마이그레이션 파일 생성 및 스냅샷 갱신 (`--dry-run`이면 파일·스냅샷을 쓰지 않고 SQL만 출력) |
| `monti migrate status` | 필요(읽기만) | DB를 변경하지 않고 `migrations` 테이블(`source = "project"`)과 `migrations/*.sql`을 대조해 적용됨/미적용 목록 출력 (테이블이 아직 없으면 전부 미적용) |
| `monti migrate up [--dry-run]` | 필요 | 운영 설정(`config.dev !== true`)에서 내장 마이그레이션과 미적용 `migrations/*.sql`(`source = "project"`)을 실행 (`--dry-run`이면 미적용 내장·프로젝트 마이그레이션 전체를 한 트랜잭션으로 시험 실행 뒤 롤백해 DB를 전혀 변경하지 않음) |
| `monti clean-files` | 필요 | `removeLooseFiles({ db, storage })` 실행 (`storage` 미설정 또는 일부 파일 삭제 실패 시 오류 종료) |

## 3. 프로젝트 부팅과 환경 변수

- **환경 변수 로딩**: 작업 디렉터리에 `.env.local`, `.env`가 있으면 Node 24 내장 `util.parseEnv`로 읽어 `기존 env > .env.local > .env` 우선순위로 합친다(파일이 없으면 기존 환경 변수를 그대로 사용한다).
  - `DATABASE_URL` (DB 연결이 필요한 명령에서 필수): PostgreSQL 연결 문자열. 없으면 오류 메시지와 함께 종료 코드 `1`로 종료한다.
  - `MONTI_SECRET` (선택): `startMonti({ ..., secret })`에 전달하는 암호화 비밀값.
- **설정·스키마 파일 로딩**: `bin` 진입점에서 `jiti` 인스턴스 하나로 CLI와 사용자 설정 파일(`monti.config.ts`, `monti.schema.ts`의 `default` export)을 함께 로드해 모듈 이중 로딩을 방지한다. `startMonti`에는 해석된 절대 경로를 `configFile`·`schemaFile`로 전달한다.
- **`config.dev` 일관성**: CLI는 `config.dev` 값을 임의로 덮어쓰지 않는다. 개발 DB(자동 동기화)와 운영 DB(마이그레이션 파일)의 혼용을 막기 위해 `monti migrate up`은 `config.dev === true`이면 실행을 거절한다.
- **자원 정리**: 명령 성공·실패와 무관하게 `finally`에서 DB 풀을 반드시 닫는다.

## 4. 범용 Operation 실행기 (`monti <resource> <action>`)

### 4.1 입력 파싱 규칙
- 명령과 옵션 이름은 `monti.spec()`의 이름 그대로 사용한다(`translationStatus`, `addLocale`, `--folder_id` 등 별도 케이스 변환 없음).
- 전역 옵션(`--config`, `--schema`, `--migrations`, `--input`, `--dry-run`, `--help`, `--version`)이 항상 우선하며, 플러그인 Operation 속성 이름이 전역 옵션과 겹치면 `--input` JSON으로 전달한다.
1. **JSON 표준 입력 (`--input`)**:
   - `--input '{"collection":"posts"}'` 또는 `--input -`(`stdin`에서 JSON 읽기)로 모든 Operation 입력(union `anyOf`, `null`, 중첩 객체 `fields`·`body`, 배열 등)을 그대로 전달한다.
2. **단순 스칼라 플래그 (`--<key> <value>`)**:
   - `--input`을 쓰지 않을 때, 해당 속성이 허용하는 스칼라 타입(`string`, `number`, `integer`, `boolean`)에 맞춰 변환해 전달한다(`body`·`fields` 같은 객체/배열이나 `string | null`의 `null`은 `--input` 사용).
   - `--input`과 개별 `--<key>` 플래그를 동시에 주면 모호함을 막기 위해 종료 코드 `2`로 거절한다.
3. **민감 입력 보호 (비밀값 가리기)**:
   - 민감 필드(`password`, `currentPassword`, `secret`, `token`)는 선택된 입력 분기에서 **필수인데 값이 비어 있을 때만** 보호 입력을 동작시킨다(`keys.update`의 선택 `secret`이나 `keys.check --id`처럼 필수가 아니면 묻지 않는다).
   - 대화형 터미널(TTY)이면 화면에 문자가 보이지 않는 숨김 프롬프트로 입력받는다.
   - 비대화형(파이프)에서는 `--input -` JSON 한 번으로 전달받는다.
   - 플래그로 직접 전달하는 것은 허용하되, 도움말에서 숨김 입력 또는 `--input -` 사용을 안내한다. `core` Operation에 CLI 전용 메타데이터는 두지 않는다.

### 4.2 `--dry-run`
- `write` Operation에 `--dry-run`을 붙이면 `monti.dryRun((tx) => tx[resource][action](input))`으로 실행하고 결과 JSON을 출력한다.
- `read` Operation이나 `--dry-run`을 지원하지 않는 내장 명령(`clean-files`, `migrate status` 등)에 `--dry-run`을 붙이면 사용 오류(종료 코드 `2`)로 거절한다.

### 4.3 출력과 종료 코드
- **표준 출력 (`stdout`)**: 성공 시 순수 JSON을 출력한다(`--help`·`-h`·인자 없는 실행·`monti migrate --help`는 표준 CLI 관례대로 도움말을, `--version`·`-v`는 버전 문자열을 `stdout`에 출력). 반환값이 없는 명령(`keys.delete`, `session.delete`, `clean-files`, 변경 없는 `migrate generate` 등)은 `null`을 출력하고, `config.get`처럼 직렬화할 수 없는 값(함수·순환 참조)이 섞인 객체는 조상 경로 순환 참조만 안전하게 끊어 직렬화 가능한 중첩 값을 보존하며 출력한다.
- **표준 오류 (`stderr`)**: 오류 메시지(코어 `ErrorCode` 5종이면 `[코드] 메시지`, 그 외 DB·파일·CLI 오류는 일반 메시지), `migrate up` 대상 DB 정보(host·DB 이름, 비밀번호 제외), `migrate generate` 변경 없음 안내를 출력한다.
- **오류 판별**: 플러그인·로더 경계에서 안전한 판별을 위해 `instanceof` 대신 오류 객체의 `code` 속성이 코어의 `ErrorCode` 집합(`BAD_REQUEST`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, `UNAUTHORIZED`)에 속하는지로 `MontiError`를 판별한다.
- **종료 코드**:
  - `0`: 성공
  - `1`: 실행 오류 (`core`가 던진 모든 `MontiError`, DB·파일·네트워크 오류)
  - `2`: CLI 명령·플래그 사용법 오류 (`core` 호출 전 파서 단계에서 잡은 알 수 없는 명령, 잘못된 플래그 조합, 읽기 명령의 `--dry-run` 등)

## 5. 스냅샷 기반 운영 마이그레이션 (`monti migrate`)

### 5.1 파일 구조
```text
migrations/
├── _snapshot.json            # 직전 생성 시점의 테이블·컬럼 스펙 스냅샷 (core의 snapshotOf 출력)
├── 0001_initial_posts.sql    # 4자리 순번 + 슬러그 이름
└── 0002_add_tags.sql
```

- 순번은 폴더 내 기존 `.sql` 파일의 최대 번호 + 1을 4자리(`0001`, `0002`, ...)로 붙인다.
- `name`을 생략하면 `schema_update`를 기본 이름으로 쓰고, 공백·특수문자는 소문자 `_`로 정규화한다.

### 5.2 SQL 생성 규칙 (`core`와 단일 함수 공유)
- `core`가 공개하는 순수 함수 `snapshotOf(schema)`와 `planSchemaDiff(prevSnapshot, nextSchema)`를 그대로 사용한다. 개발 서버의 `syncSchemaTables`와 CLI의 `migrate generate`가 **동일한 비교·판단 로직**(FK 대상 변경 시 `DROP`+`ADD`, 타입 변경 시 `castExpression` 등)을 공유한다.
- `_snapshot.json`에는 사용자 `Schema` 원본이 아니라 DB 테이블·컬럼 스펙(`snapshotOf` 결과)을 저장해, 이후 `core` 버전이 올라가도 과거 DB 상태가 변질되지 않게 한다.
- `prev`와 `next` 사이에 변경 SQL이 없으면 새 `.sql` 파일을 만들지 않고 `stdout`에 `null`, `stderr`에 `"변경 사항이 없다"` 안내를 출력한다.
- 파일 반영 시 `.sql` 파일을 먼저 기록한 뒤 `_snapshot.json`을 임시 파일에서 교체(원자적 rename)해 중간 중단으로 스냅샷이 깨지지 않게 한다.
- `--dry-run`을 주면 디스크에 `.sql` 파일과 `_snapshot.json`을 쓰지 않고 `{ "sql": "..." }` JSON만 출력한다.

### 5.3 적용(`up`)과 상태(`status`)
- `monti migrate up`:
  - `config.dev === true`이면 DB를 건드리지 않고 실행을 거절한다.
  - DB 연결 성공 후 서버에서 실제 접속한 호스트·포트·DB 이름(`current_database()`, `inet_server_addr()`, `inet_server_port()`)을 조회해 비밀번호 유출 없이 `stderr`에 출력한다.
  - 먼저 `migrateMonti({ db, schema, config })`로 `core`·플러그인 내장 마이그레이션을 적용한 뒤, `migrations/*.sql`을 파일명 오름차순으로 읽어 `core`의 공개 `migrate(db, "project", steps)`로 실행한다(`"project"`은 사용자 프로젝트 SQL 마이그레이션 전용 출처이며, 각 `.sql` 파일은 `pg` 드라이버 위에서 바인딩 없는 `sql.raw(text)`로 한 트랜잭션 안에서 실행).
  - `--dry-run`을 주면 스키마·플러그인 사전 검증(`snapshotOf`·`specOf`) 후 단일 트랜잭션 안에서 `migrations` 테이블 준비·미적용 코어(`coreMigrations`)·플러그인·프로젝트 `.sql` 단계 실행 및 이력 기록을 순서대로 시험 실행한 뒤 무조건 롤백해, 빈 DB에서도 테이블을 하나도 남기지 않는다(파일 안에 `COMMIT`이나 `CREATE INDEX CONCURRENTLY` 같은 트랜잭션 외부 구문이 없는 일반 DDL·DML을 기준으로 한다).
- `monti migrate status`:
  - `migrateMonti`를 부르지 않고 DB 연결만 열어 `migrations` 테이블의 `source = "project"` 행만 조회해 각 `.sql` 파일의 `{ name, applied }` 목록을 JSON으로 출력한다(`migrations` 테이블이 아직 없으면 생성하지 않고 모든 파일을 `applied: false`로 반환).

## 6. 폴더 구조와 코드 규칙

`core`와 동일하게 단방향 층 구조와 함수 30줄 제한, 린트·가드 규칙을 따른다.

```text
packages/cli/src/
├── bin.mjs                     [진입점] jiti 단일 로더로 실행, process.argv·exitCode·stdin·TTY 숨김 입력 처리
├── index.ts                    [공개 API] runCli(argv, io) — 테스트 가능한 순수 진입 함수
│
├── parse/                      층 0: 인자 파싱·도움말·타입 변환
│   ├── args.ts                 전역 옵션·서브커맨드 분리
│   ├── input.ts                JSON(--input) · 스칼라 플래그 → Operation 입력 변환
│   └── help.ts                 전역·리소스·액션별 도움말 생성
│
├── migrate/                    층 1: 스냅샷 기반 SQL 파일 관리·실행
│   ├── files.ts                migrations/ 폴더 읽기·쓰기·순번·_snapshot.json 관리
│   └── runner.ts               migrate generate / up / status 조율 (core의 planSchemaDiff·migrate 사용)
│
├── boot/                       층 2: 프로젝트 부팅 (환경 변수·TS 설정 파일·DB·startMonti)
│   ├── env.ts                  .env.local/.env 파싱 및 우선순위 합치기
│   ├── load.ts                 jiti 기반 monti.config.ts · monti.schema.ts 로드
│   └── connect.ts              DATABASE_URL·MONTI_SECRET 해석, pg + Kysely<Database> 연결·정리 및 startMonti 호출
│
└── commands/                   층 3: 명령 실행 조율 (parse, migrate, boot 조합)
    ├── run.ts                  최상위 명령 디스패치 및 종료 코드·오류 포매팅
    ├── operation.ts            monti <resource> <action> · spec · 비밀값 프롬프트 · --dry-run
    ├── migrate.ts              monti migrate 명령 연결
    └── clean-files.ts          monti clean-files
```

- **단방향 의존**: `parse/` → `migrate/` → `boot/` → `commands/` → `index.ts` → `bin.mjs`.
- **테스트 가능성**: `bin.mjs`만 `process.argv`/`process.exitCode`를 만지고, 모든 명령 로직은 `runCli(argv, { stdout, stderr, readStdin, promptSecret, env, cwd, isTTY, loader? })`로 주입받아 실제 PostgreSQL과 임시 디렉터리에서 테스트한다.

## 7. 작업 단계

0. **선행 PR (`packages/core` 확장)**: `core` 공개 출구(`index.ts`)에 `specOf`, `migrate`, `snapshotOf`, `planSchemaDiff` 추가 및 `docs/acceptance/core/` AC·테스트 완료 후 `dev` 머지.
1. **CLI 기반 세팅**: `packages/cli` 뼈대(`package.json`, `tsconfig.json`, `biome.json`, `.dependency-cruiser.cjs`, `knip.jsonc`, `.jscpd.json`, `vitest.config.ts`), `commitlint.config.mjs` `"cli"` 스코프, 루트 린트 연결.
2. **1단계 (`parse/` + `migrate/files.ts`)**: `docs/acceptance/cli/` 1단계 AC 승인 → 구현·테스트.
3. **2단계 (`boot/` + `migrate/runner.ts`)**: `docs/acceptance/cli/` 2단계 AC 승인 → 실제 PostgreSQL 구현·테스트.
4. **3단계 (`commands/` + `index.ts` + `bin.ts`)**: `docs/acceptance/cli/` 3단계 AC 승인 → 통합 테스트·Stryker 마무리.

## 8. 정하지 않은 것 (2단계 이후)

- `monti migrate generate --format ts`: TypeScript 마이그레이션 파일 출력 형식.
- `monti batch`: 여러 쓰기를 한 `monti.transaction`으로 묶어 실행하는 배치 명령.
- `monti init` / `monti doctor`: 새 프로젝트 초기 파일 스캐폴딩과 환경 진단.
- 콘텐츠 내보내기·가져오기(`data.export`·`data.import`)의 CLI/플러그인 배치.
- 스키마에서 다건 `relation.to` 변경·컬렉션 삭제 시 `_rels`·`media_uses` 잔여 행 정리 규칙(`core` 정책과 함께 확정).

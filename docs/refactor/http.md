# `@monti-cms/http` 개발 기준

이 문서는 `@monti-cms/http`(`packages/http`)를 개발할 때 따르는 기준이다. `core`의 계약은 [core.md](core.md)를 따른다. Next.js 전용 화면·미리보기·캐시 연결은 이 패키지에서 분리해 `@monti-cms/admin/next`([admin.md](admin.md))로 이관한다.

## 1. 경계와 원칙

판단 기준은 하나다. **"표준 HTTP 요청(`Request`)을 받아 Monti Operation을 인증·실행하고 HTTP 응답(`Response`)으로 돌려주는 데 필요한가?"**

**http가 하는 일**
- **프레임워크 중립 Web Standard 핸들러 (`createHttpHandler`)**: `(request: Request) => Promise<Response>` 표준 핸들러를 반환한다. Next Route Handler, Hono, Astro, React Router, SvelteKit, Cloudflare Workers, Bun, Node HTTP 어댑터 어디서든 그대로 연결할 수 있다.
- **범용 REST 매핑**: `monti.spec()`을 읽어 코어·플러그인의 모든 공개 Operation을 REST 경로·메서드로 자동 매핑한다. 코어 Operation에 HTTP 전용 메타데이터를 추가하지 않는다.
- **요청 입력 조립과 `?dryRun=true`**: 경로 `:id`, URL 쿼리 파라미터(`spec.input` JSON Schema 기준 타입 변환 및 중첩 `.` 표기 지원), JSON 본문을 조합해 Operation 입력을 만든다. 쓰기 Operation에 `?dryRun=true`가 오면 `monti.dryRun`으로 실행하고, 쓰기 요청에 `dryRun` 외의 쿼리 키가 오면 `400`으로 차단한다.
- **세션 쿠키 인증과 쿠키 설정·해제**:
  - 로그인(`POST /session`)·최초 관리자 생성(`POST /admin`)·현재 세션 조회(`GET /session`)를 제외한 모든 요청은 쿠키의 토큰을 `monti.session.get({ token })`으로 검증한다.
  - 로그인·최초 관리자 생성 성공 시 발급된 토큰을 `HttpOnly` `Set-Cookie`로 설정하고 응답 본문에는 토큰 원문을 노출하지 않는다.
  - 로그아웃(`DELETE /session`)과 관리자 계정 변경(`PATCH /admin`) 성공 시 세션 쿠키를 만료 삭제한다. `?dryRun=true`이거나 요청이 실패하면 쿠키를 설정·삭제하지 않는다.
- **HTTP 응답과 `MontiError` 상태 변환**:
  - `BAD_REQUEST` → `400`, `UNAUTHORIZED` → `401`, `FORBIDDEN` → `403`, `NOT_FOUND` → `404`, `CONFLICT` → `409`.
  - 예기치 않은 내부 오류는 내부 상세를 숨기고 `500` JSON 오류를 반환한다.

**http가 하지 않는 일**
- 도메인 검증·트랜잭션·암호화·DB 연결·마이그레이션(`@monti-cms/core`, `@monti-cms/cli`).
- Next.js 전용 기능(`draftMode` 미리보기, `revalidatePath`/`after` 캐시 갱신, `AdminPage` → `@monti-cms/admin/next`).
- 개발 서버 로그인 우회(`devProof`), CORS 미들웨어, 정적 파일 서빙(호스트 프레임워크의 책임).

## 2. 공개 API

```ts
export type SameSite = "lax" | "strict" | "none";

export interface CookieOptions {
	/** 세션 쿠키 이름 (기본: `"monti_session"`). 빈 문자열·공백·`;`·`=`는 허용하지 않는다. */
	name?: string;
	/** 쿠키 `Path` 속성 (기본: `"/"`). 빈 문자열·`;`는 허용하지 않는다. */
	path?: string;
	/** 쿠키 `SameSite` 속성 (기본: `"lax"`). `"none"`이면 `Secure`를 자동으로 강제한다. */
	sameSite?: SameSite;
	/** `Secure` 속성. 생략하면 요청 URL이 `https:`이거나 `sameSite === "none"`일 때 붙인다. 리버스 프록시 앞단에서 TLS가 종료되어 요청 URL이 `http:`로 들어오는 운영 환경에서는 `true`를 명시한다. */
	secure?: boolean;
	/** 쿠키 `Max-Age` 초 (기본: `2_592_000`, core 세션 수명 30일과 동일). 양의 정수만 허용한다. */
	maxAge?: number;
}

export interface HttpHandlerOptions {
	/** 핸들러가 마운트된 접두 경로 (기본: `"/api"`). `""` 또는 `"/"`면 루트 기준 매칭. */
	basePath?: string;
	/** 세션 쿠키 설정. `HttpOnly`는 항상 강제되며 끌 수 없다. `sameSite: "none"`과 `secure: false`를 함께 지정하면 핸들러 생성 시 오류를 던진다. */
	cookie?: CookieOptions;
}

export type HttpHandler = (request: Request) => Promise<Response>;

export function createHttpHandler(monti: Monti, options?: HttpHandlerOptions): HttpHandler;
```

## 3. REST 매핑 규칙

`basePath` 뒤의 상대 경로를 정규화(경계 확인, 끝 슬래시 제거, 각 세그먼트 `decodeURIComponent`)해 `monti.spec()`과 대조한다. 리소스·액션 이름은 `monti.spec()`의 이름 그대로 사용한다(`translationStatus`, `startUpload` 등 케이스 변환 없음).

### 3.1 표준 동사와 단일 리소스·단건·다건 판별

표준 동사는 `list`, `get`, `create`, `update`, `delete` 5개이며, 그 외는 모두 고유 액션(`<action>`)이다. HTTP 메서드는 대문자로 정규화해 매칭하며(`fetch`의 소문자 `"patch"` 포함), `GET` 경로에는 읽기(`kind === "read"`) Operation만 연다. 각 Operation의 `spec.input` JSON Schema(union `anyOf`·`oneOf` 포함)에서 다음 두 조건을 자동 판별한다.

- **단건 `id` 분기 (`hasIdBranch`)**: `id` 속성을 받는 객체 분기가 하나 이상 있음.
- **비-`id` 분기 (`hasNoIdBranch`)**: `id`가 필수가 아닌 객체 분기가 하나 이상 있음(단일 리소스 또는 `ids`/`before`/`all` 같은 다건·조건부 분기).

| 메서드 | 상대 경로 | 매핑 Operation | 허용 조건 | 입력 조립 |
|---|---|---|---|---|
| `GET` | `/<resource>` | `<resource>.list` 또는 `<resource>.get` | `list`가 있으면 `list` 우선, `list` 없고 `get`에 비-`id` 분기가 있으면 `get`(단일 리소스) | 쿼리 파라미터 (`session.get`은 쿠키 `token` 주입) |
| `GET` | `/<resource>/:id` | `<resource>.get` | `get`에 `id` 분기가 있음 | `{ ...쿼리, id }` (`id`는 경로 우선) |
| `POST` | `/<resource>` | `<resource>.create` | `create`가 있음 | JSON 본문 |
| `PATCH` | `/<resource>/:id` | `<resource>.update` | `update`에 `id` 분기가 있음 | `{ ...JSON 본문, id }` (`id`는 경로 우선) |
| `PATCH` | `/<resource>` | `<resource>.update` | `update`에 비-`id` 분기가 있음 (단일 리소스 또는 다건) | JSON 본문 |
| `DELETE` | `/<resource>/:id` | `<resource>.delete` | `delete`에 `id` 분기가 있음 | `{ ...JSON 본문(있으면), id }` (`id`는 경로 우선) |
| `DELETE` | `/<resource>` | `<resource>.delete` | `delete`에 비-`id` 분기가 있음 (단일 리소스 또는 다건·조건부) | JSON 본문(있으면) (`session.delete`는 쿠키 `token` 주입) |
| `POST` | `/<resource>/<action>` | `<resource>.<action>` | `<action>`이 표준 동사 5종이 아니고 해당 Operation이 있음 | JSON 본문 |

### 3.2 경로 충돌과 404 · 405 규칙

- `POST /<resource>/<action>`과 `GET`/`PATCH`/`DELETE /<resource>/:id`는 HTTP 메서드가 달라 구조적으로 충돌하지 않는다.
- `POST /<resource>/list`, `POST /<resource>/get`, `POST /<resource>/create`, `POST /<resource>/update`, `POST /<resource>/delete`처럼 표준 동사를 액션 경로로 호출하는 요청은 이중 진입을 막기 위해 허용하지 않는다.
- 경로(상대 세그먼트)에 대응하는 Operation이 다른 HTTP 메서드에는 존재하지만 현재 메서드에는 없을 때 `405 Method Not Allowed`와 `Allow` 헤더를 반환한다(`Allow` 순서는 항상 `GET, POST, PATCH, DELETE`). 예를 들어 `id` 분기가 열린 리소스의 `POST /api/entries/list`나 `POST /api/entries/unknown`은 같은 경로에 `GET`·`PATCH`가 열려 있으므로 `405` + `Allow: GET, PATCH`가 되고, `:id`가 없는 단일 리소스의 `POST /api/schema/get`·`POST /api/schema/unknown`은 어떤 메서드에도 열려 있지 않으므로 `404`가 된다.
- 어떤 메서드에도 매칭되지 않거나 `basePath` 밖(예: `/api2/...`)·세그먼트 0개 또는 3개 이상이면 `404 Not Found`를 반환한다.
- 퍼센트 인코딩이 잘못된 경로 세그먼트는 `400 BAD_REQUEST`로 거절한다.

### 3.3 쿼리 파라미터 · 본문 · `?dryRun`

- **`?dryRun`과 쓰기 요청 쿼리 보호**:
  - 쿼리에서 `dryRun`은 예약 파라미터로 소비하며 Operation 입력 객체에 넘기지 않는다.
  - `dryRun=true`이면 쓰기(`kind === "write"`) Operation을 `monti.dryRun((tx) => tx[resource][action](input))`으로 실행한다.
  - 읽기(`kind === "read"`) Operation에 `dryRun=true`를 붙이면 `400 BAD_REQUEST`로 거절한다.
  - `dryRun=false`는 일반 실행으로 취급하고, `true`/`false` 외의 값이나 `dryRun` 중복 지정은 `400 BAD_REQUEST`로 거절한다.
  - 쓰기 메서드(`POST`, `PATCH`, `DELETE`) 요청에 `dryRun` 외의 쿼리 키(`dryrun`, `dry_run`, `locale` 등)가 하나라도 들어 있으면 실수 실행을 막기 위해 `400 BAD_REQUEST`로 거절한다.
- **쿼리 파라미터 변환 (`GET`)**:
  - 점(`.`) 표기 키는 자체 속성만 따라가며 중첩 객체로 조립한다(예: `?relation.field=author&relation.id=<uuid>` → `{ relation: { field: "author", id: "<uuid>" } }`). `__proto__`, `constructor`, `prototype` 세그먼트와 스칼라·중첩 객체가 겹치는 키 충돌은 `400 BAD_REQUEST`로 거부한다.
  - `spec.input` JSON Schema의 해당 속성 타입을 참고해 변환한다:
    - `null` 허용 속성에서 `"null"` → `null` (예: `?folder_id=null`)
    - `boolean` 허용 속성에서 `"true"` → `true`, `"false"` → `false`
    - `number`/`integer` 허용 속성에서 유한 숫자 문자열 → `Number(...)`
    - `array` 허용 속성에서는 같은 키가 1개만 와도 배열(`["a"]`)로, 여러 번 오면 모든 값을 배열로 수집
    - 그 외 또는 변환 불가 값(예: 숫자 자리에 `"abc"`)은 문자열 그대로 남겨 core Zod 검증(`400 BAD_REQUEST`)이 처리하게 한다.
- **요청 본문 (`POST`, `PATCH`, `DELETE`)**:
  - 본문 크기는 UTF-8 바이트 기준 최대 `1 MiB`(`1_048_576`바이트)까지 허용하며, `Content-Length` 유무와 관계없이 스트림을 읽는 도중 상한을 넘으면 즉시 `413 PAYLOAD_TOO_LARGE`로 거절한다(공개 요청인 `POST /session`·`POST /admin` 포함).
  - 본문이 비어 있으면 `Content-Type` 헤더 없이도 `{}`로 취급한다(`DELETE /templates/:id`, `DELETE /session` 등).
  - 본문이 비어 있지 않으면 `Content-Type` 헤더의 미디어 타입이 `application/json`(대소문자 무관, `; charset=utf-8` 등 파라미터 허용)이어야 하며, 아니면 `400 BAD_REQUEST`로 거절한다(폼 CSRF 방어).
  - JSON 구문 오류이거나 최상위 값이 일반 객체(non-null, non-array)가 아니면 `400 BAD_REQUEST`로 거절한다.

## 4. 요청 처리 순서, 세션 인증, 쿠키 규칙

### 4.1 요청 처리 순서

모든 요청은 다음 순서대로 처리한다:

1. **경로 매칭**: `basePath`·퍼센트 디코딩(`400`)·리소스/메서드 매칭(`404` / `405` + `Allow`)
2. **세션 인증**: 인증 예외 경로가 아니면 쿠키 토큰 검증(`401`)
3. **입력 해석**: `?dryRun`·쓰기 쿼리 제한·`Content-Type`·JSON 파싱·쿼리 변환(`400`)
4. **Operation 실행**: `monti.<resource>.<action>(input)` 또는 `monti.dryRun(...)`
5. **응답 변환**: 쿠키 후처리(`Set-Cookie`), 토큰 비노출, 안전 JSON 직렬화, 상태 코드 반환

### 4.2 인증 정책

| 요청 | 인증 요구 | 비고 |
|---|---|---|
| `POST <base>/admin` | 예외 (비로그인 허용) | 최초 관리자 생성. 이미 있으면 core가 `409 CONFLICT`로 거절 |
| `POST <base>/session` | 예외 (비로그인 허용) | 로그인. 자격 증명 오류 시 core가 `401 UNAUTHORIZED` |
| `GET <base>/session` | 예외 (상태 조회) | 쿠키가 없으면 core 호출 없이 `200 { "admin": null }`, 쿠키가 있으면 `monti.session.get({ token })` 결과를 `200`으로 반환 |
| 그 외 모든 요청 | **필수** | 쿠키에 토큰이 없거나 `monti.session.get({ token })` 결과가 `{ admin: null }`이면 `401 UNAUTHORIZED` |

- `DELETE <base>/session`은 인증이 필요하며, 쿠키에서 꺼낸 `token`을 `monti.session.delete({ token })`에 자동 주입한다(클라이언트가 본문에 `token`을 보낼 필요 없고, 보내더라도 쿠키 토큰이 우선한다).

### 4.3 쿠키 설정과 토큰 비노출

- `Cookie` 헤더를 파싱해 `cookie.name`(기본 `"monti_session"`) 값을 읽는다.
- **`POST <base>/session` 성공** (`dryRun`이 아닐 때):
  - core 반환 `{ token }`에서 토큰을 꺼내 `Set-Cookie: <name>=<token>; HttpOnly; Path=<path>; SameSite=<SameSite>; Max-Age=<maxAge>[; Secure]` 헤더를 붙인다.
  - 응답 본문에는 토큰 원문을 노출하지 않고 `{ "ok": true }`를 반환한다(`200 OK`).
- **`POST <base>/admin` 성공** (`dryRun`이 아닐 때):
  - core 반환 `{ id, email, token }`에서 토큰을 꺼내 같은 `Set-Cookie` 헤더를 붙이고, 응답 본문은 `{ id, email }`만 반환한다(`201 Created`).
- **`DELETE <base>/session` 및 `PATCH <base>/admin` 성공** (`dryRun`이 아닐 때):
  - `Set-Cookie: <name>=; HttpOnly; Path=<path>; SameSite=<SameSite>; Max-Age=0[; Secure]` 헤더로 세션 쿠키를 만료 삭제한다.
  - 요청이 실패하면(`PATCH /admin` 비밀번호 불일치 등) 쿠키 삭제 헤더를 붙이지 않는다.
- **`?dryRun=true`일 때**:
  - 위 모든 경로에서 `Set-Cookie` 헤더를 붙이지 않으며, 응답 본문에서도 `token` 원문은 동일하게 제거한다.

## 5. HTTP 응답과 오류 형식

### 5.1 성공 응답

- 모든 응답(성공·오류·`204`)은 공유 캐시 노출을 막기 위해 `Cache-Control: no-store` 헤더를 포함한다.
- `Content-Type: application/json; charset=utf-8` (`204` 제외)
- 상태 코드:
  - `POST <base>/<resource>` (`create`, `session.create` 제외): `201 Created`
  - 반환값이 `undefined`인 경우(`templates.delete`, `keys.delete`, `session.delete` 등): `204 No Content` (본문 없음)
  - 그 외 모든 성공: `200 OK`
- **안전 JSON 직렬화**: `config.get`처럼 함수·순환 참조·`bigint`가 섞인 반환값은 조상 경로 순환 참조만 끊고 함수 제거·`bigint` 문자열화로 직렬화한다.

### 5.2 오류 응답

모든 오류 응답은 `Content-Type: application/json; charset=utf-8` 헤더와 함께 동일한 JSON 구조를 따른다.

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "오류 메시지",
    "details": "..."
  }
}
```

(`details`는 값이 `undefined`가 아닐 때만 포함한다.)

| 오류 원인 | HTTP 상태 | `error.code` |
|---|---|---|
| `MontiError("BAD_REQUEST")` / 잘못된 JSON·`Content-Type`·쿼리·인코딩·읽기 `dryRun` | `400` | `"BAD_REQUEST"` |
| `MontiError("UNAUTHORIZED")` / 미인증 요청 | `401` | `"UNAUTHORIZED"` |
| `MontiError("FORBIDDEN")` | `403` | `"FORBIDDEN"` |
| `MontiError("NOT_FOUND")` / 없는 경로·리소스 | `404` | `"NOT_FOUND"` |
| 허용되지 않은 HTTP 메서드 | `405` (+ `Allow` 헤더) | `"METHOD_NOT_ALLOWED"` |
| `MontiError("CONFLICT")` | `409` | `"CONFLICT"` |
| 요청 본문 크기 상한(1 MiB) 초과 | `413` | `"PAYLOAD_TOO_LARGE"` |
| 그 외 예기치 않은 오류 | `500` | `"INTERNAL_ERROR"` (내부 스택·상세 숨김) |

- 오류 응답 매핑은 코어 `ErrorCode` 5종(`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`)과 HTTP 본문 크기 초과 코드(`PAYLOAD_TOO_LARGE` → `413`)를 판별한다.

## 6. 폴더 구조와 코드 규칙

`core`·`cli`와 동일하게 단방향 층 구조, 함수 30줄 제한, 타입 파일 분리, 린트·가드·Stryker 규칙을 따른다.

```text
packages/http/src/
├── index.ts                [공개 API] createHttpHandler 및 공개 타입 export
│
├── protocol/               층 0: 순수 HTTP 유틸 (다른 내부 폴더 import 금지)
│   ├── types.ts            [타입] HttpHandler, HttpHandlerOptions, CookieOptions, HttpErrorBody
│   ├── cookie.ts           Cookie 헤더 파싱, 옵션 검증, Set-Cookie 발급·만료 헤더 생성
│   └── response.ts         안전 JSON 직렬화, 성공(200/201/204)·오류(400~500) Response 생성
│
├── routing/                층 1: spec 기반 라우트 매칭과 입력 조립 (protocol만 import 가능)
│   ├── types.ts            [타입] RouteTable, RouteOperation, RouteMatch, ParsedInput
│   ├── schema.ts           JSON Schema 분석(hasIdBranch, hasNoIdBranch, 속성 타입 해석)
│   ├── match.ts            basePath·메서드·경로 세그먼트 → Operation 매칭 및 404/405 판별
│   └── input.ts            URL 쿼리·경로 `:id`·Content-Type·JSON 본문 조립 및 dryRun 파싱
│
└── handler/                층 2: 요청 처리 조율 (protocol, routing 조합)
    ├── auth.ts             세션 검증, 인증 예외 판별, 세션·관리자 쿠키 후처리
    └── handler.ts          createHttpHandler 메인 요청 파이프라인
```

- **단방향 의존**: `protocol/` → `routing/` → `handler/` → `index.ts`.
- **런타임 의존성**: `@monti-cms/core`(`peerDependencies`) 외 0개. Next·React·Admin·UI 패키지 import 금지(`biome.json` 강제).
- **테스트**: `protocol/`·`routing/`은 순수 단위 테스트, `handler/`와 통합 테스트는 실제 PostgreSQL + `startMonti` + 표준 `new Request(...)`로 실행한다(DB 모킹 금지).

## 7. 작업 단계

1. **기반 세팅**: `docs/refactor/http.md`, `packages/http` 뼈대(`package.json`, `tsconfig.json`, `biome.json`, `.dependency-cruiser.cjs`, `knip.jsonc`, `.jscpd.json`, `vitest.config.ts`, `stryker.config.mjs`), `commitlint.config.mjs` `"http"` 스코프, 루트 린트 연결.
2. **1단계 (`protocol/`)**: `docs/acceptance/http/protocol.md` AC 승인 → 쿠키·안전 JSON·응답/오류 변환 구현 및 테스트.
3. **2단계 (`routing/`)**: `docs/acceptance/http/routing.md` AC 승인 → `spec` 기반 라우트 매칭(단일 리소스·단건·다건·액션·404/405) 및 쿼리·본문·`dryRun` 입력 조립 구현 및 테스트.
4. **3단계 (`handler/` + `index.ts` + 통합 테스트)**: `docs/acceptance/http/handler.md` AC 승인 → 실제 PostgreSQL + `startMonti` 기반 인증·쿠키·전체 리소스·플러그인 Operation·`dryRun` 실행 구현, 통합 테스트 및 Stryker 마무리.

## 8. 정하지 않은 것 (추후 필요 시)

- `entries.get`의 `{ collection, locale, slug }` 조회를 HTTP 경로로 별도 노출할지(현재 사이트 서버 코드는 JS에서 `monti.entries.get`을 직접 호출하고, 관리 화면은 `:id`를 사용한다).
- `Origin` 검증, 빈 본문 `POST`의 `Content-Type` 필수 여부, 별도 CSRF 토큰 헤더(기본은 `HttpOnly; SameSite=Lax` 쿠키 + 본문 `Content-Type: application/json` 요구로 방어).
- `500` 내부 오류를 호스트에 통지하는 로깅 콜백(`onError`).
- 다중 Operation 트랜잭션 배치 엔드포인트(`/batch`).

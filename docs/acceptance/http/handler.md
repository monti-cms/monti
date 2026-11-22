# `handler/` 인수 조건

[`docs/refactor/http.md`](../../refactor/http.md) 2절(공개 API), 4절(처리 순서·세션 인증·쿠키), 5절(응답·오류), 6절(`handler/`)의 인수 조건이다. 모든 테스트는 실제 PostgreSQL과 `startMonti` 위에서 표준 `Request`·`Response`로 실행한다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| 세션 인증·쿠키 (`auth.ts`) | 최초 관리자 생성·로그인 시 `HttpOnly` 쿠키를 발급하고 토큰을 본문에서 숨기며, `GET /session` 조회, `DELETE /session`·`PATCH /admin` 쿠키 만료 삭제, 그 외 모든 요청의 세션 검증을 수행한다 | 쿠키 없음·만료·위조 토큰 시 `401`(DB 미변경), 중복 관리자 시 `409`, 잘못된 로그인 시 `401`, 계정 변경 실패 시 쿠키 유지 |
| 요청 파이프라인 (`handler.ts`, `index.ts`) | 경로 매칭→인증→입력 해석→실행 순서로 표준 CRUD·쿼리 필터·다건 수정·단일 리소스·플러그인 Operation·`?dryRun=true`·공개 옵션(`basePath`, `cookie`)을 처리하고 오류를 HTTP 응답으로 매핑한다 | 경로 오류 `404`/`405`(+`Allow`), 코어 오류 5종 → `400`·`401`·`403`·`404`·`409`, 내부 예외 → 상세 숨김 `500` |

---

## 1. 세션 인증과 쿠키 생명주기 (`auth`)

### 핵심 요구사항

<details>
<summary><strong><code>HTTP-HDL-1</code></strong> 최초 관리자를 생성하면 계정 정보를 돌려주고(`201`) 세션 쿠키를 설정하며 토큰 원문은 본문에서 숨긴다</summary>

- **전제**: 관리자가 아직 없는 DB로 `createHttpHandler(monti)`를 만들었다
- **행동**: 쿠키 없이 `POST /api/admin`에 `{ email, password }` JSON 본문을 보낸다
- **결과**:
  - `HTTP-HDL-1.1` 상태 코드가 `201`이다
  - `HTTP-HDL-1.2` 본문에 `id`와 `email`이 있고 `token` 키는 없다
  - `HTTP-HDL-1.3` `set-cookie` 헤더에 `monti_session=...`과 `HttpOnly`, `SameSite=Lax`, `Max-Age=2592000`이 설정된다
  - `HTTP-HDL-1.4` 발급된 쿠키로 인증이 필요한 요청(`GET /api/templates`)을 보내면 `200`으로 통과한다

</details>

<details>
<summary><strong><code>HTTP-HDL-2</code></strong> 로그인하면 성공 응답(`200`)과 세션 쿠키를 돌려주고 응답 본문에는 토큰 원문을 숨긴다</summary>

- **전제**: 관리자가 이미 생성되어 있다
- **행동**: 쿠키 없이 HTTP와 HTTPS 요청으로 각각 `POST /api/session`에 올바른 `{ email, password }` JSON 본문을 보낸다
- **결과**:
  - `HTTP-HDL-2.1` 상태 코드가 `200`이고 본문이 `{ ok: true }`이며 `token` 키가 없다
  - `HTTP-HDL-2.2` HTTP 요청의 `set-cookie` 헤더에 `monti_session=...`과 `HttpOnly`가 설정되고 `; Secure`는 붙지 않는다
  - `HTTP-HDL-2.3` 발급된 쿠키로 `GET /api/templates`를 호출하면 `200`으로 통과한다
  - `HTTP-HDL-2.4` HTTPS 요청의 `set-cookie` 헤더에는 `; Secure`가 붙는다

</details>

<details>
<summary><strong><code>HTTP-HDL-3</code></strong> 현재 로그인 상태를 물으면(`GET /api/session`) 쿠키가 없거나 만료된 세션에는 관리자 없음을, 유효한 세션에는 관리자 정보를 돌려준다(`200`)</summary>

- **전제**: 관리자와 유효한 세션 쿠키, DB에서 만료 시각(`expires_at`)이 과거인 만료 세션 쿠키가 있다
- **행동**: 쿠키 없이, 만료된 세션 쿠키로, 유효한 세션 쿠키로 `GET /api/session`을 각각 호출한다
- **결과**:
  - `HTTP-HDL-3.1` 쿠키 없는 요청은 상태 `200`이고 본문이 `{ admin: null }`이다
  - `HTTP-HDL-3.2` 만료된 세션 쿠키 요청은 상태 `200`이고 본문이 `{ admin: null }`이다
  - `HTTP-HDL-3.3` 유효한 세션 쿠키 요청은 상태 `200`이고 본문이 `{ admin: { id, email } }`이다

</details>

<details>
<summary><strong><code>HTTP-HDL-4</code></strong> 로그아웃하면 본문의 토큰보다 쿠키의 토큰을 우선해 DB 세션을 지우고 빈 응답(`204`)과 쿠키 만료 삭제 헤더를 돌려준다</summary>

- **전제**: 로그인해 받은 유효한 세션 쿠키가 있다
- **행동**: 그 쿠키를 실어 본문에 가짜 `{ token: "wrong-token" }`을 넣어 `DELETE /api/session`을 호출한 뒤, 같은 쿠키로 다시 `GET /api/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-4.1` `DELETE /api/session`의 상태 코드가 `204`이고 본문이 비어 있다
  - `HTTP-HDL-4.2` `set-cookie` 헤더에 `monti_session=;`와 `Max-Age=0`이 포함된다
  - `HTTP-HDL-4.3` 같은 쿠키로 보낸 `GET /api/templates`가 `401`로 거절된다

</details>

<details>
<summary><strong><code>HTTP-HDL-5</code></strong> 관리자 계정을 변경하면 모든 세션을 지우고 현재 세션 쿠키도 만료 삭제한다</summary>

- **전제**: 로그인해 받은 유효한 세션 쿠키가 있다
- **행동**: 올바른 `currentPassword`와 새 `email`·`password`로 `PATCH /api/admin`을 호출한 뒤, 같은 쿠키로 `GET /api/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-5.1` `PATCH /api/admin`의 상태 코드가 `200`이고 본문에 바뀐 `email`이 담긴다
  - `HTTP-HDL-5.2` `set-cookie` 헤더에 `monti_session=;`와 `Max-Age=0`이 포함된다
  - `HTTP-HDL-5.3` 이후 같은 쿠키로 보낸 `GET /api/templates`가 `401`로 거절된다

</details>

---

## 2. 리소스 실행 · 플러그인 · `?dryRun=true` · 옵션 (`handler`)

### 핵심 요구사항

<details>
<summary><strong><code>HTTP-HDL-6</code></strong> 표준 CRUD 작업은 생성(`201`), 조회·수정(`200`), 빈 반환 삭제(`204`)의 상태 코드와 본문을 돌려준다</summary>

- **전제**: `posts` 컬렉션이 있는 스키마와 로그인된 세션 쿠키가 있다
- **행동**: `POST /api/templates`로 템플릿을 만든 뒤 `GET /api/templates`, `GET /api/templates/:id`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`를 순서대로 호출한다
- **결과**:
  - `HTTP-HDL-6.1` `POST /api/templates`는 `201`로 생성된 템플릿을 반환한다
  - `HTTP-HDL-6.2` `GET /api/templates`와 `GET /api/templates/:id`는 `200`으로 생성된 템플릿을 반환한다
  - `HTTP-HDL-6.3` `PATCH /api/templates/:id`는 `200`으로 바뀐 이름의 템플릿을 반환한다
  - `HTTP-HDL-6.4` `DELETE /api/templates/:id`는 `204`이고 본문이 비어 있으며 DB `templates` 테이블에서 행이 삭제된다

</details>

<details>
<summary><strong><code>HTTP-HDL-7</code></strong> 글 목록 조회에서 `folder_id=null`과 점(`.`) 관계 쿼리 필터가 실제 DB 결과와 맞물려 동작한다</summary>

- **전제**: `authors`·`posts`(관계 필드 `author` 포함) 컬렉션과 `posts` 폴더, 글 3건(루트 폴더에 있고 `author`를 참조하는 글, 루트 폴더에 있지만 `author`를 참조하지 않는 글, 하위 폴더에 있고 `author`를 참조하는 글)이 있고 세션 쿠키가 있다
- **행동**: `GET /api/entries?collection=posts&status=draft&folder_id=null&relation.field=author&relation.id=<authorId>`를 호출한다
- **결과**:
  - `HTTP-HDL-7.1` 상태 `200`으로 루트 폴더에 있고 해당 `author`를 참조하는 글 1건만 반환한다

</details>

<details>
<summary><strong><code>HTTP-HDL-8</code></strong> 다건 수정 요청(`PATCH /api/entries`)으로 여러 글의 폴더를 한 번에 바꿀 수 있다</summary>

- **전제**: `posts` 컬렉션의 글 2건과 활성 폴더 1개가 있고 로그인된 세션 쿠키가 있다
- **행동**: `PATCH /api/entries`에 `{ ids: [글1, 글2], folder_id: 폴더 }`를 보낸다
- **결과**:
  - `HTTP-HDL-8.1` 상태 `200`으로 정확히 두 글의 바뀐 `folder_id` 목록만 반환한다

</details>

<details>
<summary><strong><code>HTTP-HDL-9</code></strong> 함수가 섞인 설정 단일 리소스(`GET /api/config`)를 오류 없이 안전하게 JSON으로 응답한다</summary>

- **전제**: 메서드 함수들을 가진 `storage` 어댑터와 `plugins`가 설정된 `monti` 인스턴스와 로그인된 세션 쿠키가 있다
- **행동**: `GET /api/config`를 호출한다
- **결과**:
  - `HTTP-HDL-9.1` 상태 `200`으로 사이트 `name`을 포함한 JSON을 반환한다
  - `HTTP-HDL-9.2` `storage` 객체의 함수 키(`ticket`, `stat`, `url`, `remove`)가 응답 본문에 포함되지 않는다

</details>

<details>
<summary><strong><code>HTTP-HDL-10</code></strong> 플러그인이 등록한 리소스와 고유 액션도 별도 설정 없이 같은 REST 규칙으로 호출할 수 있다</summary>

- **전제**: `list`, `create`, 고유 액션을 가진 리소스를 등록한 테스트용 플러그인으로 `startMonti`를 만들고 로그인된 세션 쿠키가 있다
- **행동**: 해당 플러그인 리소스에 대해 `GET /api/<resource>`, `POST /api/<resource>`, `POST /api/<resource>/<action>`을 호출한다
- **결과**:
  - `HTTP-HDL-10.1` `GET`은 `200`으로 플러그인 목록 결과를 반환한다
  - `HTTP-HDL-10.2` `POST` 생성은 `201`로 플러그인 생성 결과를 반환한다
  - `HTTP-HDL-10.3` `POST` 고유 액션은 `200`으로 플러그인 액션 결과를 반환한다

</details>

<details>
<summary><strong><code>HTTP-HDL-11</code></strong> 쓰기 요청에 `?dryRun=true`를 붙이면 예상 결과만 돌려주고 실제 DB는 바꾸지 않는다</summary>

- **전제**: `posts` 컬렉션이 있는 스키마와 로그인된 세션 쿠키가 있다
- **행동**: `POST /api/templates?dryRun=true`로 템플릿 생성을 시험 실행한 뒤 DB의 `templates` 테이블을 조회한다
- **결과**:
  - `HTTP-HDL-11.1` 응답 상태가 `201`이고 예상 템플릿 객체가 반환된다
  - `HTTP-HDL-11.2` DB `templates` 테이블에는 행이 저장되어 있지 않다

</details>

<details>
<summary><strong><code>HTTP-HDL-12</code></strong> 인증·관리자 쓰기에 `?dryRun=true`를 붙이면 세션 쿠키를 발급하거나 지우지 않으며 토큰 원문도 노출하지 않는다</summary>

- **전제**: 관리자가 없는 DB로 만든 핸들러(최초 관리자 생성용)와, 관리자가 있고 로그인된 세션 쿠키가 있는 핸들러(로그인·로그아웃용)가 있다
- **행동**: `POST /api/admin?dryRun=true`, `POST /api/session?dryRun=true`, `DELETE /api/session?dryRun=true`를 각각 호출하고, 로그아웃 시험 실행 뒤 같은 쿠키로 `GET /api/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-12.1` `POST /api/admin?dryRun=true`는 `201`, `{ id, email }` 본문(`token` 키 없음), `set-cookie` 헤더 없음이고 DB `admin` 테이블에 행이 없다
  - `HTTP-HDL-12.2` `POST /api/session?dryRun=true`는 `200`, `{ ok: true }` 본문(`token` 키 없음), `set-cookie` 헤더 없음이고 DB `session` 행 수가 늘지 않는다
  - `HTTP-HDL-12.3` `DELETE /api/session?dryRun=true`는 `204`, `set-cookie` 헤더 없음이고 이어서 같은 쿠키로 보낸 `GET /api/templates`가 `200`으로 통과한다

</details>

<details>
<summary><strong><code>HTTP-HDL-13</code></strong> `createHttpHandler`의 `basePath`와 `cookie` 옵션이 전체 요청 파이프라인에 적용된다</summary>

- **전제**: 관리자가 있는 DB에 `createHttpHandler(monti, { basePath: "/cms", cookie: { name: "sid", path: "/cms", secure: true } })`로 핸들러를 만들었다
- **행동**: HTTP 요청으로 `POST /cms/session`에 로그인한 뒤 발급된 `sid` 쿠키로 `GET /cms/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-13.1` `POST /cms/session`의 `set-cookie` 헤더가 `sid=`와 `Path=/cms`와 `; Secure`를 사용한다
  - `HTTP-HDL-13.2` 발급된 `sid` 쿠키로 보낸 `GET /cms/templates`가 `200`으로 통과한다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-HDL-14</code></strong> 없는 경로·허용되지 않은 메서드는 인증보다 먼저 거절하고(`404`, `405`), 미인증 요청의 깨진 본문은 로그인 거절(`401`)이 먼저 돌아온다</summary>

- **전제**: 관리자가 생성된 DB로 `createHttpHandler(monti)`를 만들었다
- **행동**: 쿠키 없이 `GET /api/unknown`, `DELETE /api/schema`, 깨진 JSON 본문의 `POST /api/templates`를 각각 호출한다
- **결과**:
  - `HTTP-HDL-14.1` `GET /api/unknown`은 `404`와 `error.code === "NOT_FOUND"` JSON을 돌려준다
  - `HTTP-HDL-14.2` `DELETE /api/schema`는 `405`, `allow: "GET, PATCH"`, `error.code === "METHOD_NOT_ALLOWED"` JSON을 돌려준다
  - `HTTP-HDL-14.3` 쿠키 없는 깨진 JSON의 `POST /api/templates`는 `400`이 아니라 `401`과 `error.code === "UNAUTHORIZED"` JSON을 돌려준다

</details>

<details>
<summary><strong><code>HTTP-HDL-15</code></strong> 로그인하지 않았거나 만료·위조된 세션 쿠키로 보호된 API를 호출하면 거절하고(`401`) DB를 바꾸지 않는다</summary>

- **전제**: 관리자가 생성되어 있고, 만료된 세션 쿠키와 위조 토큰 쿠키가 준비되어 있다
- **행동**: 쿠키 없이, 만료 쿠키로, 위조 쿠키로 `GET /api/templates`와 `POST /api/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-15.1` 모든 요청이 상태 `401`이고 본문의 `error.code`가 `"UNAUTHORIZED"`이다
  - `HTTP-HDL-15.2` DB `templates` 테이블에 행이 저장되지 않는다

</details>

<details>
<summary><strong><code>HTTP-HDL-16</code></strong> 검증 실패·잘못된 로그인·권한 없음·없는 대상·중복 관리자가 각각의 HTTP 오류 상태와 JSON 형식으로 반환된다</summary>

- **전제**: 운영 모드(`dev: false`)로 시작한 `monti`에 관리자와 로그인된 세션 쿠키, 활성 글 1건이 있다
- **행동**: 잘못된 본문의 `POST /api/templates`, 틀린 비밀번호의 `POST /api/session`, 운영 서버의 `PATCH /api/config`, 없는 UUID의 `GET /api/templates/:id`, 중복 관리자 생성 `POST /api/admin`, 그리고 잘못된 경로 `:id`로 다건 이동·슬러그 조회를 시도하는 `PATCH /api/entries/invalid-id`·`GET /api/entries/invalid-id?collection=posts&locale=ko&slug=...`를 각각 호출한다
- **결과**:
  - `HTTP-HDL-16.1` 잘못된 본문의 `POST /api/templates`는 `400`과 `error.code === "BAD_REQUEST"`이다
  - `HTTP-HDL-16.2` 틀린 비밀번호의 `POST /api/session`은 `401`과 `error.code === "UNAUTHORIZED"`이다
  - `HTTP-HDL-16.3` 운영 서버의 `PATCH /api/config`는 `403`과 `error.code === "FORBIDDEN"`이다
  - `HTTP-HDL-16.4` 없는 UUID의 `GET /api/templates/:id`는 `404`과 `error.code === "NOT_FOUND"`이다
  - `HTTP-HDL-16.5` 중복 관리자 생성 `POST /api/admin`은 `409`와 `error.code === "CONFLICT"`이다
  - `HTTP-HDL-16.6` 잘못된 경로 `:id`의 단건 `PATCH`·`GET`은 다건/슬러그 분기로 넘어가지 않고 모두 `400`(`BAD_REQUEST`)으로 거절된다

</details>

<details>
<summary><strong><code>HTTP-HDL-17</code></strong> 작업 실행 중 예기치 않은 내부 오류가 나면 내부 상세를 숨기고 서버 오류(`500`)를 돌려준다</summary>

- **전제**: 실행 시 `new Error("secret internal failure")`를 던지는 테스트용 플러그인 액션이 등록되어 있고 로그인된 세션 쿠키가 있다
- **행동**: 해당 플러그인 액션을 `POST /api/<resource>/<action>`으로 호출한다
- **결과**:
  - `HTTP-HDL-17.1` 상태 코드가 `500`이고 본문의 `error.code`가 `"INTERNAL_ERROR"`이다
  - `HTTP-HDL-17.2` 응답 본문에 `"secret internal failure"`가 포함되지 않는다

</details>

<details>
<summary><strong><code>HTTP-HDL-18</code></strong> 현재 비밀번호가 틀려 관리자 계정 변경에 실패하면 세션 쿠키를 지우지 않는다</summary>

- **전제**: 로그인해 받은 유효한 세션 쿠키가 있다
- **행동**: 틀린 `currentPassword`로 `PATCH /api/admin`을 호출한 뒤, 같은 쿠키로 `GET /api/templates`를 호출한다
- **결과**:
  - `HTTP-HDL-18.1` `PATCH /api/admin`의 상태 코드가 `401`이고 `set-cookie` 헤더가 없다
  - `HTTP-HDL-18.2` 같은 쿠키로 보낸 `GET /api/templates`가 `200`으로 통과한다

</details>

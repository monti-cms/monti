# `routing/` 인수 조건

[`docs/refactor/http.md`](../../refactor/http.md) 3절(REST 매핑 규칙·경로 충돌·쿼리/본문/`?dryRun`), 6절(`routing/`)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| 라우트 매칭 (`schema.ts`, `match.ts`) | `OperationSpec[]`의 JSON Schema를 읽어 단일 리소스·단건·다건·고유 액션 경로와 HTTP 메서드를 자동 매핑한다 | `basePath` 밖·경계 위반·없는 리소스·단일 리소스 `:id`·열린 메서드가 없는 경로는 `404`, 다른 메서드로 열린 경로의 메서드 불일치·표준 동사 액션 경로는 `405` + `Allow`, 잘못된 인코딩은 `400` |
| 입력 조립 (`input.ts`) | 경로 `:id`, `GET` 쿼리(스칼라·`null`·배열·점 중첩 객체), `Content-Type`·JSON 본문(최대 1 MiB), `?dryRun`을 해석해 Operation 입력을 만든다 | 읽기 `?dryRun=true`, 잘못된 `dryRun` 값, 쓰기 요청의 `dryRun` 외 쿼리 키, `application/json`이 아닌 본문·깨진/비객체 JSON 본문, 위험한 점 키(`__proto__` 등) 시 `400`, 본문 1 MiB 초과 시 `PAYLOAD_TOO_LARGE` |

---

## 1. `spec` 기반 라우트 매칭 (`schema` · `match`)

### 핵심 요구사항

<details>
<summary><strong><code>HTTP-RUT-1</code></strong> 표준 동사(`list`, `get`, `create`, `update`, `delete`)를 각각의 HTTP 메서드와 경로로 매핑하고 `GET /<resource>`에서는 목록을 우선한다</summary>

- **전제**: 코어 기본 `specOf()` 명세로 라우트 테이블을 만들었다 (`basePath: "/api"`)
- **행동**: `GET /api/templates`, `GET /api/entries`(비-`id` `get` 분기와 `list`가 함께 있는 리소스), `GET /api/templates/t1`, `POST /api/templates`, `PATCH /api/templates/t1`, 소문자 `patch /api/templates/t1`, `DELETE /api/templates/t1`을 각각 매칭한다
- **결과**:
  - `HTTP-RUT-1.1` `GET /api/templates`는 `templates.list`로 매칭된다
  - `HTTP-RUT-1.2` `GET /api/entries`는 `entries.get`이 아니라 `entries.list`로 매칭된다
  - `HTTP-RUT-1.3` `GET /api/templates/t1`은 `templates.get`(`id: "t1"`)으로 매칭된다
  - `HTTP-RUT-1.4` `POST /api/templates`는 `templates.create`로 매칭된다
  - `HTTP-RUT-1.5` `PATCH /api/templates/t1`은 `templates.update`(`id: "t1"`)로 매칭된다
  - `HTTP-RUT-1.6` `DELETE /api/templates/t1`은 `templates.delete`(`id: "t1"`)로 매칭된다
  - `HTTP-RUT-1.7` 소문자 `patch /api/templates/t1`도 `templates.update`(`id: "t1"`)로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-2</code></strong> 목록이 없는 단일 리소스는 `:id` 없는 경로로 조회·수정·삭제에 매핑한다</summary>

- **전제**: 코어 리소스와 단일 리소스 `get`을 등록한 테스트용 플러그인을 포함한 `specOf(plugins)` 명세로 라우트 테이블을 만들었다 (`basePath: "/api"`)
- **행동**: `GET /api/schema`, `PATCH /api/schema`, `GET /api/session`, `DELETE /api/session`, `PATCH /api/admin`, 플러그인 단일 리소스 `GET /api/<pluginResource>`를 각각 매칭한다
- **결과**:
  - `HTTP-RUT-2.1` `GET /api/schema`는 `schema.get`, `PATCH /api/schema`는 `schema.update`로 매칭되며 경로 `id`가 없다
  - `HTTP-RUT-2.2` `GET /api/session`은 `session.get`, `DELETE /api/session`은 `session.delete`, `PATCH /api/admin`은 `admin.update`로 매칭되며 경로 `id`가 없다
  - `HTTP-RUT-2.3` 플러그인의 `GET /api/<pluginResource>`는 해당 단일 리소스 `get`으로 매칭되며 경로 `id`가 없다

</details>

<details>
<summary><strong><code>HTTP-RUT-3</code></strong> 단건과 다건 입력을 함께 받는 리소스는 `:id` 유무로 경로를 나눠 매핑한다</summary>

- **전제**: 코어 기본 `specOf()` 명세와 `oneOf` 판별 유니온(`id` 분기·`ids` 분기)을 가진 테스트용 플러그인 `update`로 라우트 테이블을 만들었다 (`basePath: "/api"`)
- **행동**: `PATCH /api/entries/e1`, `PATCH /api/entries`, `DELETE /api/trash/t1`, `DELETE /api/trash`, 플러그인 `oneOf` 리소스의 `PATCH` 단건·다건 경로를 각각 매칭한다
- **결과**:
  - `HTTP-RUT-3.1` `PATCH /api/entries/e1`은 `entries.update`(`id: "e1"`)로 매칭된다
  - `HTTP-RUT-3.2` `PATCH /api/entries`는 `entries.update`(경로 `id` 없음)로 매칭된다
  - `HTTP-RUT-3.3` `DELETE /api/trash/t1`은 `trash.delete`(`id: "t1"`)로 매칭된다
  - `HTTP-RUT-3.4` `DELETE /api/trash`는 `trash.delete`(경로 `id` 없음)로 매칭된다
  - `HTTP-RUT-3.5` `oneOf` 판별 유니온 리소스도 `:id` 경로와 컬렉션 경로 모두 `update`로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-4</code></strong> 표준 동사 외의 고유 액션과 플러그인 액션을 이름 대소문자 그대로 `POST /<resource>/<action>`으로 매핑하고 `GET`에는 읽기 작업만 연다</summary>

- **전제**: 코어 리소스와 고유 쓰기 액션, 그리고 `list` 이름으로 쓰기(`write`) 작업을 등록한 테스트용 플러그인을 포함한 `specOf(plugins)` 명세로 라우트 테이블을 만들었다
- **행동**: `POST /api/entries/publish`, `POST /api/media/startUpload`, `POST /api/keys/check`, 플러그인의 `POST /api/<pluginResource>/<action>`, 그리고 쓰기 `list` 리소스에 대한 `GET`을 각각 매칭한다
- **결과**:
  - `HTTP-RUT-4.1` `POST /api/entries/publish`는 `entries.publish`, `POST /api/media/startUpload`는 `media.startUpload`로 매칭된다
  - `HTTP-RUT-4.2` `POST /api/keys/check`는 `keys.check`(`kind: "read"`)로 매칭된다
  - `HTTP-RUT-4.3` 플러그인의 `POST /api/<pluginResource>/<action>`은 해당 고유 액션으로 매칭된다
  - `HTTP-RUT-4.4` 쓰기 Operation이 `list` 이름으로 등록된 리소스는 `GET` 경로로 열리지 않는다(`not_found`)

</details>

<details>
<summary><strong><code>HTTP-RUT-5</code></strong> 사용자 지정 `basePath`와 루트 기준(`""`, `"/"`)에서 경로를 매칭한다</summary>

- **전제**: `basePath: "/admin/api"`, `basePath: ""`, `basePath: "/"` 세 라우트 테이블이 있다
- **행동**: `/admin/api/templates`, 루트(`""`)의 `/entries/e1`, 루트(`"/"`)의 `/entries/e1`을 각각 `GET`으로 매칭한다
- **결과**:
  - `HTTP-RUT-5.1` `basePath: "/admin/api"`에서 `/admin/api/templates`는 `templates.list`로 매칭된다
  - `HTTP-RUT-5.2` `basePath: ""`에서 `/entries/e1`은 `entries.get`(`id: "e1"`)으로 매칭된다
  - `HTTP-RUT-5.3` `basePath: "/"`에서 `/entries/e1`은 `entries.get`(`id: "e1"`)으로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-6</code></strong> 경로 끝 슬래시를 제거하고 퍼센트 인코딩된 `:id` 세그먼트를 디코딩해 매칭한다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: `GET /api/templates/`와 `GET /api/templates/id%2F1`을 각각 매칭한다
- **결과**:
  - `HTTP-RUT-6.1` `GET /api/templates/`는 `templates.list`로 매칭된다
  - `HTTP-RUT-6.2` `GET /api/templates/id%2F1`은 `templates.get`으로 매칭되고 경로 `id`가 `"id/1"`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-RUT-7</code></strong> API 밖의 경로, 경계가 다른 접두 경로, 없는 리소스·단일 리소스 `:id`·3단 이상 경로는 찾을 수 없음(`404`)으로 분류한다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: `GET /other/entries`, `GET /api_templates`, `GET /api`, `GET /api/unknown`, `GET /api/schema/abc`, `POST /api/schema/unknown`, `GET /api/entries/a/b`를 각각 매칭한다
- **결과**:
  - `HTTP-RUT-7.1` 일곱 경로 모두 미발견(`not_found`) 결과를 돌려준다

</details>

<details>
<summary><strong><code>HTTP-RUT-8</code></strong> 다른 메서드로 열린 경로에 허용되지 않은 메서드를 보내면 정해진 순서의 허용 목록과 함께 거절한다(`405`)</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: `DELETE /api/schema`, `PATCH /api/templates`(단건 전용 리소스에 `:id` 없음), `POST /api/entries/unknown`(`:id` 경로가 `GET`·`PATCH`로 열림), `POST /api/templates/t1`(`:id` 경로가 `GET`·`PATCH`·`DELETE`로 열림)을 각각 매칭한다
- **결과**:
  - `HTTP-RUT-8.1` `DELETE /api/schema`는 메서드 미허용(`method_not_allowed`)이며 허용 목록이 `["GET", "PATCH"]`이다
  - `HTTP-RUT-8.2` `PATCH /api/templates`는 메서드 미허용이며 허용 목록이 `["GET", "POST"]`이다
  - `HTTP-RUT-8.3` `POST /api/entries/unknown`은 메서드 미허용이며 허용 목록이 `["GET", "PATCH"]`이다
  - `HTTP-RUT-8.4` `POST /api/templates/t1`은 메서드 미허용이며 허용 목록이 `["GET", "PATCH", "DELETE"]`이다

</details>

<details>
<summary><strong><code>HTTP-RUT-9</code></strong> 표준 동사를 `POST /<resource>/<verb>` 액션 경로로 호출하는 것을 허용하지 않는다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: `POST /api/entries/list`, `POST /api/entries/create`, `POST /api/entries/update`, `POST /api/templates/delete`(`:id` 경로가 다른 메서드로 열림)와 `POST /api/schema/get`(`:id` 경로가 열려 있지 않음)을 각각 매칭한다
- **결과**:
  - `HTTP-RUT-9.1` `entries`의 `list`·`create`·`update`는 메서드 미허용(`["GET", "PATCH"]`), `templates`의 `delete`는 메서드 미허용(`["GET", "PATCH", "DELETE"]`)이다
  - `HTTP-RUT-9.2` `POST /api/schema/get`은 미발견(`not_found`) 결과를 돌려준다

</details>

<details>
<summary><strong><code>HTTP-RUT-10</code></strong> 경로 세그먼트의 퍼센트 인코딩이 잘못되었으면 거절한다(`400`)</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: `GET /api/templates/%E0%A4%A`를 매칭한다
- **결과**:
  - `HTTP-RUT-10.1` `BAD_REQUEST` 오류를 던진다

</details>

---

## 2. 요청 입력 조립과 `?dryRun` (`input`)

### 핵심 요구사항

<details>
<summary><strong><code>HTTP-RUT-11</code></strong> `GET` 쿼리를 작업 명세 타입(`null`·숫자·참거짓)과 점(`.`) 중첩 객체로 변환한다</summary>

- **전제**: `folder_id`(문자열 또는 `null`), `limit`(정수), `score`(실수 `number`), `draft`(불리언), `code`(문자열), `relation`(`{ field: string, id: string }` 중첩 객체)을 받는 `GET` 작업 명세가 있다
- **행동**: `?folder_id=null&limit=20&score=3.5&draft=true&code=123&relation.field=author&relation.id=u1` 쿼리와 `?folder_id=abc&draft=false` 쿼리로 각각 입력을 조립한다
- **결과**:
  - `HTTP-RUT-11.1` 첫 쿼리는 `{ folder_id: null, limit: 20, score: 3.5, draft: true, code: "123", relation: { field: "author", id: "u1" } }`로 조립된다
  - `HTTP-RUT-11.2` 둘째 쿼리는 `{ folder_id: "abc", draft: false }`로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-12</code></strong> `GET` 쿼리의 배열 속성은 값이 하나만 와도 배열로, 여러 번 오면 모두 배열로 모은다</summary>

- **전제**: `tags`(문자열 배열)를 받는 `GET` 작업 명세가 있다
- **행동**: 값이 하나뿐인 쿼리(`?tags=only`)와 같은 키가 여러 번 온 쿼리(`?tags=a&tags=b`)로 각각 입력을 조립한다
- **결과**:
  - `HTTP-RUT-12.1` `?tags=only`는 `{ tags: ["only"] }`로 조립된다
  - `HTTP-RUT-12.2` `?tags=a&tags=b`는 `{ tags: ["a", "b"] }`로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-13</code></strong> 경로 `:id`와 쿼리 또는 JSON 본문을 합쳐 입력을 만들며 경로 `:id`가 우선한다</summary>

- **전제**: `GET /api/entries/path-id?locale=en&id=query-id` 요청과 `PATCH /api/templates/path-id` 요청(`Content-Type: application/json ; charset=utf-8`, 본문 `{"id":"body-id","name":"새 이름"}`)이 있다
- **행동**: 두 요청의 입력을 각각 조립한다
- **결과**:
  - `HTTP-RUT-13.1` `GET` 입력은 `{ id: "path-id", locale: "en" }`이다
  - `HTTP-RUT-13.2` `PATCH` 입력은 `{ id: "path-id", name: "새 이름" }`이다

</details>

<details>
<summary><strong><code>HTTP-RUT-14</code></strong> 쓰기 요청의 `?dryRun=true`를 시험 실행 플래그로 분리하고 입력 객체에서는 뺀다</summary>

- **전제**: 쓰기 작업 `entries.create`에 대한 `POST /api/entries?dryRun=true`와 `POST /api/entries?dryRun=false` 요청(`Content-Type: application/json`, 본문 `{"collection":"posts","locale":"ko"}`), 그리고 읽기 작업의 `GET /api/entries?dryRun=false&collection=posts` 요청이 있다
- **행동**: 세 요청의 입력과 `dryRun` 여부를 해석한다
- **결과**:
  - `HTTP-RUT-14.1` `?dryRun=true`는 `dryRun: true`이고 입력 객체에 `dryRun` 키가 없으며 `{ collection: "posts", locale: "ko" }`만 들어 있다
  - `HTTP-RUT-14.2` 쓰기 `?dryRun=false`는 `dryRun: false`이다
  - `HTTP-RUT-14.3` 읽기 `GET /api/entries?dryRun=false&collection=posts`는 `dryRun: false`이고 입력 객체에 `dryRun` 키가 없는 `{ collection: "posts" }`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-RUT-15</code></strong> `GET` 쿼리에서 명세 타입으로 바꿀 수 없는 값은 거절하지 않고 문자열 그대로 둔다</summary>

- **전제**: `limit`(정수), `score`(실수), `draft`(불리언)을 받는 `GET` 작업 명세가 있다
- **행동**: `?limit=abc&score=&draft=yes` 쿼리로 입력을 조립한다
- **결과**:
  - `HTTP-RUT-15.1` 오류를 던지지 않고 `{ limit: "abc", score: "", draft: "yes" }`로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-16</code></strong> 읽기 작업에 `?dryRun=true`를 붙이면 거절한다(`400`)</summary>

- **전제**: 읽기 작업 `entries.list`의 `GET /api/entries?dryRun=true`와 읽기 고유 액션 `keys.check`의 `POST /api/keys/check?dryRun=true` 요청이 있다
- **행동**: 두 요청의 입력을 각각 해석한다
- **결과**:
  - `HTTP-RUT-16.1` `GET /api/entries?dryRun=true`는 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-16.2` `POST /api/keys/check?dryRun=true`는 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-17</code></strong> `dryRun` 값이 `true`나 `false`가 아니거나 두 번 이상 지정되면 거절한다(`400`)</summary>

- **전제**: `POST /api/entries?dryRun=yes`, `POST /api/entries?dryRun=1`, 중복 지정 `POST /api/entries?dryRun=false&dryRun=true`·`POST /api/entries?dryRun=true&dryRun=yes` 요청이 있다
- **행동**: 각 요청의 입력을 해석한다
- **결과**:
  - `HTTP-RUT-17.1` `dryRun=yes`와 `dryRun=1` 모두 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-17.2` `dryRun`을 두 번 이상 지정한 요청도 모두 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-18</code></strong> 쓰기 요청에 `dryRun` 외의 쿼리 키가 하나라도 붙으면 거절한다(`400`)</summary>

- **전제**: 오타 쿼리 `POST /api/entries?dryrun=true`, `DELETE /api/trash?dry_run=true`와 일반 키 `POST /api/entries?locale=ko` 요청이 있다
- **행동**: 세 요청의 입력을 각각 해석한다
- **결과**:
  - `HTTP-RUT-18.1` 세 요청 모두 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-19</code></strong> 본문이 비어 있지 않을 때 `Content-Type`이 `application/json`이 아니면 거절한다(`400`)</summary>

- **전제**: 본문이 `'{"name":"a"}'`이고 `Content-Type`이 `text/plain`인 요청과 `Content-Type` 헤더가 없는 요청이 있다
- **행동**: 두 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-19.1` `text/plain` 본문 요청은 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-19.2` `Content-Type` 없는 비어 있지 않은 본문 요청은 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-20</code></strong> 깨진 JSON 본문이나 객체가 아닌 최상위 JSON 본문은 거절한다(`400`)</summary>

- **전제**: `Content-Type: application/json`에 본문이 `"{broken"`, `"[1,2]"`, `"123"`, `"null"`인 요청들이 있다
- **행동**: 각 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-20.1` 네 경우 모두 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-21</code></strong> 본문이 비어 있는 쓰기 요청은 `Content-Type` 없이도 빈 객체로 처리한다</summary>

- **전제**: `Content-Type` 헤더와 본문이 모두 비어 있는 `DELETE /api/templates/t1` 요청과 `DELETE /api/session` 요청이 있다
- **행동**: 두 요청의 입력을 각각 조립한다
- **결과**:
  - `HTTP-RUT-21.1` `DELETE /api/templates/t1`은 `{ id: "t1" }`로 조립된다
  - `HTTP-RUT-21.2` `DELETE /api/session`은 `{}`로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-22</code></strong> 점(`.`) 중첩 쿼리의 위험한 프로토타입 키와 키 충돌은 거절하고(`400`), 상속 속성 이름은 전역 객체를 건드리지 않는다</summary>

- **전제**: 위험 키 쿼리(`?__proto__.polluted=1`, `?relation.constructor.x=1`, `?relation.prototype.y=1`), 상속 속성 쿼리(`?toString.evil=1`, `?toString.length=1`), 그리고 스칼라·객체 충돌 쿼리(`?folder_id.extra=1&folder_id=null`, `?folder_id=null&folder_id.extra=1`)가 있다
- **행동**: 각 요청의 쿼리를 입력 객체로 조립한다
- **결과**:
  - `HTTP-RUT-22.1` 위험 키 세 경우 모두 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-22.2` 상속 속성 쿼리는 예외 없이 자체 속성 객체로 조립되며 `Object.prototype.toString`에 속성이 추가되지 않는다
  - `HTTP-RUT-22.3` 스칼라와 중첩 객체가 겹치는 충돌 쿼리 두 순서 모두 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-23</code></strong> 허용 크기(1 MiB)를 넘는 요청 본문은 끝까지 읽지 않고 거절한다</summary>

- **전제**: `Content-Length` 헤더가 없고, 1 MiB를 넘긴 뒤에도 끝나지 않는 본문 스트림을 가진 `application/json` 요청이 있다
- **행동**: 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-23.1` 스트림이 끝나기를 기다리지 않고 `code`가 `"PAYLOAD_TOO_LARGE"`인 오류를 던진다

</details>

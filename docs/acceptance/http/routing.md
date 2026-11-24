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
- **행동**: 표준 동사의 메서드와 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-1.1` `GET /<resource>`는 `list`, `GET`·`PATCH`·`DELETE /<resource>/:id`는 경로 `id`를 가진 `get`·`update`·`delete`, `POST /<resource>`는 `create`로 매칭된다
  - `HTTP-RUT-1.2` `list`와 `id` 없는 `get` 분기를 함께 가진 리소스의 `GET /<resource>`는 `list`로 매칭된다
  - `HTTP-RUT-1.7` 소문자 메서드도 같은 작업으로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-2</code></strong> 목록이 없는 단일 리소스는 `:id` 없는 경로로 조회·수정·삭제에 매핑한다</summary>

- **전제**: 코어 리소스와 단일 리소스 `get`을 등록한 테스트용 플러그인을 포함한 `specOf(plugins)` 명세로 라우트 테이블을 만들었다 (`basePath: "/api"`)
- **행동**: 단일 리소스의 `:id` 없는 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-2.1` 코어 단일 리소스의 `GET`·`PATCH`·`DELETE /<resource>`는 `get`·`update`·`delete`로 매칭되며 경로 `id`가 없다
  - `HTTP-RUT-2.3` 플러그인 단일 리소스도 같은 방식으로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-3</code></strong> 단건과 다건 입력을 함께 받는 리소스는 `:id` 유무로 경로를 나눠 매핑한다</summary>

- **전제**: 코어 기본 `specOf()` 명세와 `oneOf` 판별 유니온(`id` 분기·`ids` 분기)을 가진 테스트용 플러그인 `update`로 라우트 테이블을 만들었다 (`basePath: "/api"`)
- **행동**: 단건·다건 입력을 함께 받는 리소스의 `:id` 경로와 `:id` 없는 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-3.1` `:id` 경로는 경로 `id`를 가진 같은 작업으로 매칭된다
  - `HTTP-RUT-3.2` `:id` 없는 경로는 경로 `id` 없이 같은 작업으로 매칭된다
  - `HTTP-RUT-3.5` `oneOf` 판별 유니온 리소스도 같은 방식으로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-4</code></strong> 표준 동사 외의 고유 액션과 플러그인 액션을 이름 대소문자 그대로 `POST /<resource>/<action>`으로 매핑하고 `GET`에는 읽기 작업만 연다</summary>

- **전제**: 코어 리소스와 고유 쓰기 액션, 그리고 `list` 이름으로 쓰기(`write`) 작업을 등록한 테스트용 플러그인을 포함한 `specOf(plugins)` 명세로 라우트 테이블을 만들었다
- **행동**: 고유 액션 경로와 쓰기 `list` 리소스의 `GET` 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-4.1` 코어 고유 액션은 이름 대소문자 그대로 `POST /<resource>/<action>`으로 매칭된다
  - `HTTP-RUT-4.2` 읽기 고유 액션도 `POST /<resource>/<action>`으로 매칭된다
  - `HTTP-RUT-4.3` 플러그인 고유 액션도 같은 방식으로 매칭된다
  - `HTTP-RUT-4.4` 쓰기 Operation이 `list` 이름으로 등록된 리소스는 `GET` 경로로 열리지 않는다(`not_found`)

</details>

<details>
<summary><strong><code>HTTP-RUT-5</code></strong> 사용자 지정 `basePath`와 루트 기준(`""`, `"/"`)에서 경로를 매칭한다</summary>

- **전제**: 사용자 지정 `basePath`와 루트 기준 `basePath`(`""`, `"/"`)의 라우트 테이블이 있다
- **행동**: 각 `basePath` 아래 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-5.1` 사용자 지정 `basePath` 아래 경로가 해당 작업으로 매칭된다
  - `HTTP-RUT-5.2` `basePath`가 `""`이든 `"/"`이든 루트 아래 경로가 해당 작업으로 매칭된다

</details>

<details>
<summary><strong><code>HTTP-RUT-6</code></strong> 경로 끝 슬래시를 제거하고 퍼센트 인코딩된 `:id` 세그먼트를 디코딩해 매칭한다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: 끝에 슬래시가 붙은 경로와 퍼센트 인코딩된 `:id` 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-6.1` 끝 슬래시를 뗀 경로와 같은 작업으로 매칭된다
  - `HTTP-RUT-6.2` 경로 `id`는 디코딩된 값이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-RUT-7</code></strong> API 밖의 경로, 경계가 다른 접두 경로, 없는 리소스·단일 리소스 `:id`·3단 이상 경로는 찾을 수 없음(`404`)으로 분류한다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: 열린 작업이 없는 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-7.1` 모두 미발견(`not_found`) 결과를 돌려준다

</details>

<details>
<summary><strong><code>HTTP-RUT-8</code></strong> 다른 메서드로 열린 경로에 허용되지 않은 메서드를 보내면 정해진 순서의 허용 목록과 함께 거절한다(`405`)</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: 다른 메서드로만 열린 경로에 열리지 않은 메서드로 매칭한다
- **결과**:
  - `HTTP-RUT-8.1` 메서드 미허용(`method_not_allowed`)이며 허용 목록이 그 경로에 열린 메서드를 정해진 순서로 담는다(예: 템플릿 `:id` 경로는 `["GET", "PATCH", "DELETE"]`)

</details>

<details>
<summary><strong><code>HTTP-RUT-9</code></strong> 표준 동사를 `POST /<resource>/<verb>` 액션 경로로 호출하는 것을 허용하지 않는다</summary>

- **전제**: `basePath: "/api"`인 라우트 테이블이 있다
- **행동**: 표준 동사 이름을 액션 자리에 넣은 `POST /<resource>/<verb>` 경로를 매칭한다
- **결과**:
  - `HTTP-RUT-9.1` `:id` 경로가 다른 메서드로 열린 리소스에서는 메서드 미허용(`method_not_allowed`)이다
  - `HTTP-RUT-9.2` `:id` 경로가 열려 있지 않은 리소스에서는 미발견(`not_found`)이다

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

- **전제**: 여러 타입의 속성과 중첩 객체 속성을 받는 `GET` 작업 명세가 있다
- **행동**: 그 속성들을 담은 쿼리로 입력을 조립한다
- **결과**:
  - `HTTP-RUT-11.1` 쿼리 값이 명세 타입대로 바뀌고(문자열 타입은 숫자 모양이어도 문자열) 점(`.`) 키는 중첩 객체로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-12</code></strong> `GET` 쿼리의 배열 속성은 값이 하나만 와도 배열로, 여러 번 오면 모두 배열로 모은다</summary>

- **전제**: 문자열 배열 속성을 받는 `GET` 작업 명세가 있다
- **행동**: 그 키가 한 번 온 쿼리와 여러 번 온 쿼리로 입력을 조립한다
- **결과**:
  - `HTTP-RUT-12.1` 한 번 온 값은 1개짜리 배열로 조립된다
  - `HTTP-RUT-12.2` 여러 번 온 값은 온 순서대로 모두 배열로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-13</code></strong> 경로 `:id`와 쿼리 또는 JSON 본문을 합쳐 입력을 만들며 경로 `:id`가 우선한다</summary>

- **전제**: 경로 `:id`와 다른 `id`를 쿼리에 담은 `GET` 요청과, 경로 `:id`와 다른 `id`를 JSON 본문에 담은 `PATCH` 요청이 있다
- **행동**: 두 요청의 입력을 조립한다
- **결과**:
  - `HTTP-RUT-13.1` `GET` 입력은 쿼리 값에 경로 `:id`를 `id`로 합친 객체이다
  - `HTTP-RUT-13.2` `PATCH` 입력은 본문 값에 경로 `:id`를 `id`로 합친 객체이다

</details>

<details>
<summary><strong><code>HTTP-RUT-14</code></strong> 쓰기 요청의 `?dryRun=true`를 시험 실행 플래그로 분리하고 입력 객체에서는 뺀다</summary>

- **전제**: `?dryRun=true`와 `?dryRun=false`를 붙인 쓰기 요청, `?dryRun=false`를 붙인 읽기 요청이 있다
- **행동**: 요청의 입력과 `dryRun` 여부를 해석한다
- **결과**:
  - `HTTP-RUT-14.1` 쓰기 `?dryRun=true`는 `dryRun: true`이고 입력 객체에 `dryRun` 키가 없다
  - `HTTP-RUT-14.2` 쓰기 `?dryRun=false`는 `dryRun: false`이다
  - `HTTP-RUT-14.3` 읽기 `?dryRun=false`는 `dryRun: false`이고 입력 객체에 `dryRun` 키가 없다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-RUT-15</code></strong> `GET` 쿼리에서 명세 타입으로 바꿀 수 없는 값은 거절하지 않고 문자열 그대로 둔다</summary>

- **전제**: 숫자·참거짓 속성을 받는 `GET` 작업 명세가 있다
- **행동**: 그 타입으로 바꿀 수 없는 값을 담은 쿼리로 입력을 조립한다
- **결과**:
  - `HTTP-RUT-15.1` 오류를 던지지 않고 값이 문자열 그대로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-16</code></strong> 읽기 작업에 `?dryRun=true`를 붙이면 거절한다(`400`)</summary>

- **전제**: 읽기 작업의 `GET` 요청과 읽기 고유 액션의 `POST` 요청에 `?dryRun=true`가 붙어 있다
- **행동**: 요청의 입력을 해석한다
- **결과**:
  - `HTTP-RUT-16.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-17</code></strong> `dryRun` 값이 `true`나 `false`가 아니거나 두 번 이상 지정되면 거절한다(`400`)</summary>

- **전제**: `dryRun` 값이 `true`·`false`가 아닌 쓰기 요청과 `dryRun`을 두 번 지정한 쓰기 요청이 있다
- **행동**: 요청의 입력을 해석한다
- **결과**:
  - `HTTP-RUT-17.1` 값이 `true`·`false`가 아니면 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-17.2` 두 번 이상 지정하면 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-18</code></strong> 쓰기 요청에 `dryRun` 외의 쿼리 키가 하나라도 붙으면 거절한다(`400`)</summary>

- **전제**: `dryRun` 외의 쿼리 키가 붙은 쓰기 요청이 있다
- **행동**: 요청의 입력을 해석한다
- **결과**:
  - `HTTP-RUT-18.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-19</code></strong> 본문이 비어 있지 않을 때 `Content-Type`이 `application/json`이 아니면 거절한다(`400`)</summary>

- **전제**: 본문이 있고 `Content-Type`이 `text/plain`인 요청과 `Content-Type` 헤더가 없는 요청이 있다
- **행동**: 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-19.1` `text/plain` 본문 요청은 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-19.2` `Content-Type` 없는 비어 있지 않은 본문 요청은 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-20</code></strong> 깨진 JSON 본문이나 객체가 아닌 최상위 JSON 본문은 거절한다(`400`)</summary>

- **전제**: `Content-Type: application/json`에 깨진 JSON이나 최상위가 객체가 아닌 JSON 본문을 담은 요청이 있다
- **행동**: 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-20.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-21</code></strong> 본문이 비어 있는 쓰기 요청은 `Content-Type` 없이도 빈 객체로 처리한다</summary>

- **전제**: `Content-Type` 헤더와 본문이 모두 없는 `:id` 경로 쓰기 요청과 `:id` 없는 경로 쓰기 요청이 있다
- **행동**: 두 요청의 입력을 조립한다
- **결과**:
  - `HTTP-RUT-21.1` `:id` 경로 요청은 `{ id }`만 가진 객체로 조립된다
  - `HTTP-RUT-21.2` `:id` 없는 경로 요청은 `{}`로 조립된다

</details>

<details>
<summary><strong><code>HTTP-RUT-22</code></strong> 점(`.`) 중첩 쿼리의 위험한 프로토타입 키와 키 충돌은 거절하고(`400`), 상속 속성 이름은 전역 객체를 건드리지 않는다</summary>

- **전제**: 위험한 프로토타입 키(`__proto__`, `constructor`, `prototype`)가 든 점 쿼리, 상속 속성 이름으로 시작하는 점 쿼리, 같은 키를 스칼라와 중첩 객체로 함께 쓴 쿼리가 있다
- **행동**: 요청의 쿼리를 입력 객체로 조립한다
- **결과**:
  - `HTTP-RUT-22.1` 위험 키 쿼리는 `BAD_REQUEST` 오류를 던진다
  - `HTTP-RUT-22.2` 상속 속성 쿼리는 예외 없이 자체 속성 객체로 조립되며 `Object.prototype`의 상속 속성에 속성이 추가되지 않는다
  - `HTTP-RUT-22.3` 스칼라와 중첩 객체가 겹치는 쿼리는 키 순서와 관계없이 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-RUT-23</code></strong> 허용 크기(1 MiB)를 넘는 요청 본문은 끝까지 읽지 않고 거절하고, 정확히 1 MiB인 JSON 본문은 조립한다</summary>

- **전제**: `Content-Length` 헤더가 없고 1 MiB를 넘긴 뒤에도 끝나지 않는 본문 스트림을 가진 `application/json` 요청과, UTF-8 바이트 크기가 정확히 `1_048_576`바이트(1 MiB)인 유효한 JSON 요청이 있다
- **행동**: 두 요청의 본문을 파싱해 입력을 조립한다
- **결과**:
  - `HTTP-RUT-23.1` 1 MiB를 넘는 스트림은 끝나기를 기다리지 않고 `code`가 `"PAYLOAD_TOO_LARGE"`인 오류를 던진다
  - `HTTP-RUT-23.2` 정확히 1 MiB인 요청은 해당 JSON 객체로 조립된다

</details>

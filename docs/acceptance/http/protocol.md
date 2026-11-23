# `protocol/` 인수 조건

[`docs/refactor/http.md`](../../refactor/http.md) 2절(쿠키 옵션), 4절(쿠키 설정), 5절(HTTP 응답과 오류 형식), 6절(`protocol/`)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| 쿠키 파싱·헤더 생성 (`cookie.ts`) | `Cookie` 헤더에서 세션 토큰을 읽고, 쿠키 옵션을 검증해 `HttpOnly` 세션 발급·만료 삭제 `Set-Cookie` 헤더를 만든다 | 헤더 없음·이름 미일치 시 빈 결과 반환, `sameSite: "none"` + `secure: false` 조합·잘못된 쿠키 이름·경로·수명 시 설정 오류 |
| 응답·오류 변환 (`response.ts`) | 성공(`200`·`201`·`204`), 안전 JSON 직렬화, 코어 `MontiError`(`400`·`401`·`403`·`404`·`409`), `405`(`Allow`), `500` JSON 응답을 만든다 | 예기치 않은 오류는 내부 상세를 숨기고 `500` 반환 |

---

## 1. 쿠키와 HTTP 응답 변환 (`cookie` · `response`)

### 핵심 요구사항

<details>
<summary><strong><code>HTTP-PRO-1</code></strong> 요청의 `Cookie` 헤더에서 지정한 이름의 쿠키 값을 꺼낸다</summary>

- **전제**: 여러 쿠키(`theme=dark; monti_session=tok=en123==; lang=ko`)가 들어 있는 `Cookie` 헤더 문자열이 있다
- **행동**: `monti_session` 이름의 쿠키 값을 읽는다
- **결과**:
  - `HTTP-PRO-1.1` 등호(`=`)를 포함한 토큰 값 `"tok=en123=="`이 그대로 반환된다

</details>

<details>
<summary><strong><code>HTTP-PRO-2</code></strong> 기본 옵션으로 세션 쿠키 발급 헤더를 만들면 `HttpOnly`와 기본 보안 속성이 들어간다</summary>

- **전제**: 기본 쿠키 옵션과 토큰 값 `"secret-token"`이 있다
- **행동**: HTTP 요청 기준으로 세션 쿠키 발급 헤더를 생성한다
- **결과**:
  - `HTTP-PRO-2.1` 헤더 문자열이 `"monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000"`이다

</details>

<details>
<summary><strong><code>HTTP-PRO-3</code></strong> `secure` 옵션을 생략하면 요청이 HTTPS일 때만 `Secure` 속성이 붙는다</summary>

- **전제**: `secure`를 지정하지 않은 기본 쿠키 옵션과 토큰 값 `"secret-token"`이 있다
- **행동**: HTTP 요청(`isHttps: false`)과 HTTPS 요청(`isHttps: true`)으로 각각 발급 헤더를 생성한다
- **결과**:
  - `HTTP-PRO-3.1` HTTP 요청 헤더에는 `; Secure`가 붙지 않는다
  - `HTTP-PRO-3.2` HTTPS 요청 헤더는 `"monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Secure"`이다

</details>

<details>
<summary><strong><code>HTTP-PRO-4</code></strong> 사용자 지정 쿠키 옵션이 발급 헤더에 반영되고 `HttpOnly`는 유지된다</summary>

- **전제**: 커스텀 옵션(`name: "sid"`, `path: "/admin"`, `sameSite: "strict"`, `maxAge: 3600`, `secure: true`), `secure: false`를 명시한 옵션, `sameSite: "none"`만 지정한 옵션이 있다
- **행동**: 각 옵션으로 토큰 `"secret-token"`의 발급 헤더를 생성한다(`secure: false`는 HTTPS 기준, `sameSite: "none"`은 HTTP 기준)
- **결과**:
  - `HTTP-PRO-4.1` 커스텀 옵션의 헤더가 `"sid=secret-token; HttpOnly; Path=/admin; SameSite=Strict; Max-Age=3600; Secure"`이다
  - `HTTP-PRO-4.2` `secure: false`를 명시한 옵션은 HTTPS 요청에서도 `"monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000"`으로 `; Secure`가 붙지 않는다
  - `HTTP-PRO-4.3` `sameSite: "none"` 옵션은 HTTP 요청에서도 `"monti_session=secret-token; HttpOnly; Path=/; SameSite=None; Max-Age=2592000; Secure"`으로 `; Secure`가 자동으로 붙는다

</details>

<details>
<summary><strong><code>HTTP-PRO-5</code></strong> 세션 쿠키 삭제 헤더는 지정한 이름과 경로에 빈 값과 `Max-Age=0`으로 쿠키를 즉시 만료시킨다</summary>

- **전제**: 사용자 지정 쿠키 옵션(`name: "sid"`, `path: "/admin"`, `sameSite: "strict"`)과 HTTPS 요청이 있다
- **행동**: 세션 쿠키 삭제 헤더를 생성한다
- **결과**:
  - `HTTP-PRO-5.1` `"sid=; HttpOnly; Path=/admin; SameSite=Strict; Max-Age=0; Secure"` 헤더가 생성된다

</details>

<details>
<summary><strong><code>HTTP-PRO-6</code></strong> 성공 응답을 작업 성격에 맞는 상태(`200`, `201`, `204`)와 JSON 본문, 선택적 `Set-Cookie` 헤더로 만든다</summary>

- **전제**: 응답 데이터 `{ id: "1" }`와 `Set-Cookie` 헤더 문자열이 준비되어 있다
- **행동**: `200` JSON 응답, `201` + `Set-Cookie` 응답, `204` 빈 응답을 각각 생성한다
- **결과**:
  - `HTTP-PRO-6.1` `200` 응답은 상태 `200`, `content-type`이 `application/json; charset=utf-8`, `cache-control`이 `no-store`, 본문이 `{"id":"1"}`이다
  - `HTTP-PRO-6.2` `201` 응답은 상태 `201`, `cache-control`이 `no-store`, `set-cookie` 헤더가 전달한 문자열과 같고 본문이 `{"id":"1"}`이다
  - `HTTP-PRO-6.3` `204` 응답은 상태 `204`, `cache-control`이 `no-store`, `content-type` 헤더 없음, 본문이 비어 있다

</details>

<details>
<summary><strong><code>HTTP-PRO-7</code></strong> 함수·순환 참조·큰 정수가 섞인 값도 안전하게 JSON 응답으로 직렬화한다</summary>

- **전제**: 함수 속성, 공유 참조(`first`, `second`), 조상 순환 참조(`self`), `bigint`(`123n`)가 든 객체, `toJSON()`이 새 객체로 자기 자신을 다시 가리키는 순환 객체, 그리고 최상위 함수 값이 있다
- **행동**: 세 값으로 각각 `200` JSON 응답을 생성한다
- **결과**:
  - `HTTP-PRO-7.1` 오류 없이 모두 `200` 응답이 생성된다
  - `HTTP-PRO-7.2` 첫 응답의 파싱한 본문이 `{ name: "Monti", count: "123", first: { tag: "x" }, second: { tag: "x" } }`와 일치한다
  - `HTTP-PRO-7.3` `toJSON()` 순환 객체는 순환 속성이 끊긴 `{}`로, 최상위 함수 값은 `null` JSON으로 직렬화된다

</details>

<details>
<summary><strong><code>HTTP-PRO-8</code></strong> 코어 오류를 대응하는 HTTP 오류 상태(`400`, `401`, `403`, `404`, `409`)와 오류 JSON으로 바꾼다</summary>

- **전제**: 코어 `ErrorCode` 5종(`BAD_REQUEST` + `details`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`)의 오류 객체와, `MontiError` 프로토타입이 아닌 일반 `Error`에 `code: "CONFLICT"`만 붙인 오류 객체가 있다
- **행동**: 각 오류 객체를 HTTP 오류 응답으로 변환한다
- **결과**:
  - `HTTP-PRO-8.1` 상태 코드가 순서대로 `400`, `401`, `403`, `404`, `409`이고 모두 `content-type`이 `application/json; charset=utf-8`이다
  - `HTTP-PRO-8.2` `details`가 있는 오류의 본문이 `{ error: { code: "BAD_REQUEST", message: "잘못된 입력", details: { field: "slug" } } }`이다
  - `HTTP-PRO-8.3` `details`가 없는 오류의 본문에는 `details` 키가 빠진 `{ error: { code: "UNAUTHORIZED", message: "인증 필요" } }`이다
  - `HTTP-PRO-8.4` 프로토타입이 다른 코어 오류 객체도 `409`와 `{ error: { code: "CONFLICT", message: "다른 경계 충돌" } }`로 변환된다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>HTTP-PRO-9</code></strong> `Cookie` 헤더가 없거나 찾는 이름의 쿠키가 없으면 빈 결과를 돌려준다</summary>

- **전제**: `null` 헤더, 빈 문자열 헤더, 다른 이름의 쿠키만 있는 헤더(`other=1`)가 있다
- **행동**: 각 헤더에서 `monti_session` 쿠키 값을 읽는다
- **결과**:
  - `HTTP-PRO-9.1` 세 경우 모두 `undefined`를 돌려준다

</details>

<details>
<summary><strong><code>HTTP-PRO-10</code></strong> `SameSite=None` 쿠키는 `Secure`를 끈 채로 설정할 수 없다</summary>

- **전제**: `{ sameSite: "none", secure: false }` 쿠키 옵션이 있다
- **행동**: 그 쿠키 옵션을 해석한다
- **결과**:
  - `HTTP-PRO-10.1` 쿠키 설정 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-PRO-13</code></strong> 쿠키 이름이 비어 있거나 구분자(`;`, `=`, 공백)나 제어 문자가 들어 있으면 설정할 수 없다</summary>

- **전제**: `name`이 비어 있거나 `;`, `=`, 공백, 줄바꿈 같은 제어 문자 중 하나가 들어 있는 쿠키 옵션이 있다
- **행동**: 그 쿠키 옵션을 해석한다
- **결과**:
  - `HTTP-PRO-13.1` 쿠키 설정 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-PRO-14</code></strong> 쿠키 경로가 비어 있거나 `;`나 제어 문자가 들어 있으면 설정할 수 없다</summary>

- **전제**: `path`가 비어 있거나 `;` 또는 줄바꿈 같은 제어 문자가 들어 있는 쿠키 옵션이 있다
- **행동**: 그 쿠키 옵션을 해석한다
- **결과**:
  - `HTTP-PRO-14.1` 쿠키 설정 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-PRO-15</code></strong> 쿠키 수명이 양의 정수가 아니면 설정할 수 없다</summary>

- **전제**: `maxAge`가 양의 정수가 아닌 쿠키 옵션이 있다
- **행동**: 그 쿠키 옵션을 해석한다
- **결과**:
  - `HTTP-PRO-15.1` 쿠키 설정 오류를 던진다

</details>

<details>
<summary><strong><code>HTTP-PRO-11</code></strong> 코어 오류가 아닌 예기치 않은 오류나 직렬화 불가능한 오류도 내부 상세를 숨기고 서버 오류(`500`)로 바꾼다</summary>

- **전제**: 일반 `Error("db connection failed: internal detail")`, 문자열 예외 `"unexpected"`, `code`가 배열이거나 `message`가 빠진 비정상 오류 객체, 그리고 `details.toJSON()`이 예외를 던지는 코어 오류가 있다
- **행동**: 각 예외를 HTTP 오류 응답으로 변환한다
- **결과**:
  - `HTTP-PRO-11.1` 일반 오류와 문자열 예외는 모두 상태 `500`, `content-type`이 `application/json; charset=utf-8`, `cache-control`이 `no-store`, 본문의 `error.code`가 `"INTERNAL_ERROR"`이다
  - `HTTP-PRO-11.2` 두 응답 본문 모두에 원본 오류 문자열(`"db connection failed: internal detail"`, `"unexpected"`)이 포함되지 않는다
  - `HTTP-PRO-11.3` `code`가 배열이거나 `message`가 누락된 객체, 그리고 `details.toJSON()`이 예외를 던지는 오류도 예외를 전파하지 않고 `500` `INTERNAL_ERROR` JSON으로 응답한다

</details>

<details>
<summary><strong><code>HTTP-PRO-12</code></strong> 열려 있지 않은 메서드로 호출하면 허용된 메서드 목록과 함께 거절한다(`405`)</summary>

- **전제**: 허용 메서드 목록 `["GET", "POST"]`가 주어졌다
- **행동**: 메서드 미허용 오류 응답을 생성한다
- **결과**:
  - `HTTP-PRO-12.1` 상태 코드가 `405`, `allow` 헤더가 `"GET, POST"`, `content-type`이 `application/json; charset=utf-8`이다
  - `HTTP-PRO-12.2` 본문의 `error.code`가 `"METHOD_NOT_ALLOWED"`이다

</details>

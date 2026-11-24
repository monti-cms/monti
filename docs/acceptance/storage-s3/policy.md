# `policy.ts` 인수 조건

[`docs/refactor/storage-s3.md`](../../refactor/storage-s3.md) 3절(보안·업로드 정책)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `assertSafeKey` | 소문자 UUID 형식의 파일 키만 통과시킨다 | 빈 문자열·경로 표기·일반 파일명·대문자 UUID 등 UUID 외 모든 문자열 시 `BAD_REQUEST` |
| `validateUploadPolicy` | 허용된 MIME 타입과 최대 크기 이내의 업로드만 통과시키고 소문자로 정규화한 MIME을 돌려준다 | 비허용 MIME(SVG·HTML 등)·파라미터가 붙은 MIME·최대 크기 초과·0 이하/비정수 크기 시 `BAD_REQUEST` |
| `dispositionOf` | 브라우저에서 바로 보여 줄 이미지(`undefined`)와 내려받게 할 파일(`"attachment"`)을 구분한다 | 없음 |

---

## 1. 파일 키 검증 (`assertSafeKey`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-POL-1</code></strong> 소문자 UUID 형식의 파일 키는 통과한다</summary>

- **전제**: 소문자 UUID 문자열 `"550e8400-e29b-41d4-a716-446655440000"`이 있다
- **행동**: `assertSafeKey("550e8400-e29b-41d4-a716-446655440000")`를 실행한다
- **결과**:
  - `S3-POL-1.1` 오류 없이 끝난다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-POL-2</code></strong> UUID 형식이 아닌 파일 키는 사용할 수 없다</summary>

- **전제**: 소문자 UUID 형식이 아닌 키가 있다
- **행동**: 그 키로 `assertSafeKey`를 실행한다
- **결과**:
  - `S3-POL-2.1` `BAD_REQUEST` 오류를 던진다

</details>

---

## 2. 업로드 MIME·크기 정책 (`validateUploadPolicy`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-POL-3</code></strong> 기본 허용 형식과 1바이트~최대 크기(10 MiB) 파일은 올릴 수 있고 형식 이름은 소문자로 통일된다</summary>

- **전제**: 기본 허용 목록(`DEFAULT_ALLOWED_MIME_TYPES`)과 기본 최대 크기(`DEFAULT_MAX_SIZE`, 10 MiB) 정책이 있다
- **행동**: 대문자가 섞인 허용 형식과 범위 끝 크기로 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-3.1` 오류 없이 소문자로 바꾼 형식을 돌려준다

</details>

<details>
<summary><strong><code>S3-POL-4</code></strong> 사용자가 직접 정한 허용 형식과 최대 크기가 기본 규칙을 대체하며 대소문자를 구분하지 않는다</summary>

- **전제**: `allowedMimeTypes`와 `maxSize`를 지정한 사용자 정책이 있다
- **행동**: 사용자 목록의 형식과 기본 목록에만 있는 형식으로 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-4.1` 사용자 목록의 형식은 대소문자와 관계없이 통과하고 소문자 형식을 돌려준다
  - `S3-POL-4.2` 기본 목록에만 있는 형식은 `BAD_REQUEST` 오류를 던진다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-POL-5</code></strong> 기본 규칙에서는 스크립트 실행 위험이 있는 SVG와 HTML을 올릴 수 없다</summary>

- **전제**: 기본 업로드 정책이 있다
- **행동**: `mime: "image/svg+xml"`과 `mime: "text/html"`로 각각 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-5.1` `"image/svg+xml"` 호출이 `BAD_REQUEST` 오류를 던진다
  - `S3-POL-5.2` `"text/html"` 호출이 `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>S3-POL-6</code></strong> 부가 옵션이 붙은 형식 문자열은 올릴 수 없다</summary>

- **전제**: 기본 업로드 정책이 있다
- **행동**: `mime: "image/png; charset=utf-8"`, `size: 1024`로 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-6.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>S3-POL-7</code></strong> 최대 크기를 넘는 파일은 올릴 수 없다</summary>

- **전제**: 기본 업로드 정책(`DEFAULT_MAX_SIZE`)이 있다
- **행동**: `mime: "image/png"`, `size: DEFAULT_MAX_SIZE + 1`로 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-7.1` `BAD_REQUEST` 오류를 던진다

</details>

<details>
<summary><strong><code>S3-POL-8</code></strong> 크기가 0 이하이거나 정수가 아닌 파일은 올릴 수 없다</summary>

- **전제**: 기본 업로드 정책이 있다
- **행동**: 0 이하이거나 정수가 아닌 `size`로 `validateUploadPolicy`를 실행한다
- **결과**:
  - `S3-POL-8.1` `BAD_REQUEST` 오류를 던진다

</details>

---

## 3. 표시 헤더 정책 (`dispositionOf`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-POL-9</code></strong> 브라우저에서 바로 보여 줄 이미지와 내려받게 할 파일을 구분한다</summary>

- **전제**: `"image/png"`, `"application/pdf"`, `"image/svg+xml"` MIME 문자열이 있다
- **행동**: 세 MIME으로 각각 `dispositionOf`를 실행한다
- **결과**:
  - `S3-POL-9.1` `"image/png"`의 반환값이 `undefined`이다
  - `S3-POL-9.2` `"application/pdf"`의 반환값이 `"attachment"`이다
  - `S3-POL-9.3` `"image/svg+xml"`의 반환값이 `"attachment"`이다

</details>

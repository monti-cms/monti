# `adapter.ts` 인수 조건

[`docs/refactor/storage-s3.md`](../../refactor/storage-s3.md) 4절(`StorageAdapter` 동작)의 인수 조건이다. 지연 설정 검사(`Error`)는 [`config.md`](config.md)에서 다룬다. 모든 S3 요청 테스트는 실제 `@aws-sdk/client-s3`와 `@aws-sdk/s3-request-presigner`를 로컬 SigV4 검증 HTTP 서버(`__test__/fake-s3.ts`)에 연결해 실행한다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `ticket` | 키와 업로드 정책을 검증한 뒤 1회용 서명 `PUT` URL과 업로드 헤더(`content-type`, `cache-control`, `if-none-match`, 비이미지·SVG면 `content-disposition`)를 돌려준다 | UUID 외 키·비허용 MIME·잘못된 크기 시 `BAD_REQUEST`, 재업로드 시 `412`, 서명 헤더 변조 시 `403` |
| `stat` | 버킷에 올라간 객체의 `{ mime, size }`를 조회하고 없는 키는 `null`을 돌려준다 | UUID 외 키 시 `BAD_REQUEST`, 권한·서버 오류 그대로 전파 |
| `url` | `<publicUrl>/<key>` 형식의 파일 읽기 URL을 돌려준다 | UUID 외 키 시 `BAD_REQUEST` |
| `remove` | 버킷의 객체를 삭제하며 이미 없는 키(`204` 또는 `NoSuchKey`)도 오류 없이 성공한다 | UUID 외 키 시 `BAD_REQUEST`, `NoSuchBucket`(404)·권한·서버 오류 그대로 전파 |

---

## 1. 업로드 티켓 발급 (`ticket`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-ADP-1</code></strong> 이미지 업로드 허가 주소로 파일을 올리면 버킷에 저장된다</summary>

- **전제**: 로컬 S3 대역 서버와 `ticketSeconds: 300`으로 설정된 `s3Storage` 어댑터가 있다
- **행동**: UUID `key`와 `mime: "image/png"`, 16바이트 크기로 `adapter.ticket`을 호출한 뒤 반환된 `url`과 `headers`로 해당 16바이트를 `PUT` 요청한다
- **결과**:
  - `S3-ADP-1.1` 반환된 `headers`가 정확히 `{ "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "if-none-match": "*" }`이다(`content-disposition`·`content-length` 없음)
  - `S3-ADP-1.2` 반환된 `url`의 `X-Amz-Expires`가 `"300"`이고 `X-Amz-SignedHeaders`가 `"cache-control;content-length;content-type;host;if-none-match"`이다
  - `S3-ADP-1.3` `PUT` 응답 상태가 `200`이고 대역 버킷에 저장된 객체의 바이트·`content-type`·`cache-control`이 요청 값과 일치한다

</details>

<details>
<summary><strong><code>S3-ADP-2</code></strong> 이미지가 아닌 파일을 올릴 때는 열면 바로 내려받아지도록 헤더를 서명해 저장한다</summary>

- **전제**: 로컬 S3 대역 서버를 가리키는 `s3Storage` 어댑터가 있다
- **행동**: UUID `key`와 `mime: "application/pdf"`, 20바이트 크기로 `adapter.ticket`을 호출한 뒤 반환된 `url`과 `headers`로 해당 20바이트를 `PUT` 요청한다
- **결과**:
  - `S3-ADP-2.1` 반환된 `headers`에 `"content-disposition": "attachment"`가 포함되어 있고 `X-Amz-SignedHeaders`에 `content-disposition`이 포함되어 있다
  - `S3-ADP-2.2` `PUT` 응답 상태가 `200`이고 대역 버킷에 저장된 객체의 `content-disposition`이 `"attachment"`이다

</details>

<details>
<summary><strong><code>S3-ADP-3</code></strong> 이미 올라간 파일의 업로드 허가 주소로 다시 올릴 수 없고 원본 파일이 유지된다</summary>

- **전제**: 로컬 S3 대역 서버에서 발급받은 티켓으로 원본 16바이트가 이미 `PUT`되어 버킷에 저장되어 있다
- **행동**: 같은 티켓의 `url`과 `headers`로 다른 16바이트를 다시 `PUT` 요청한다
- **결과**:
  - `S3-ADP-3.1` 두 번째 `PUT` 응답 상태가 `412`이다
  - `S3-ADP-3.2` 대역 버킷에 저장된 객체의 바이트가 첫 번째 업로드 그대로이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-ADP-4</code></strong> 업로드 허가에 서명된 형식·크기·표시 헤더를 바꾸거나 빼고 올리면 거절되고 파일이 저장되지 않는다</summary>

- **전제**: 로컬 SigV4 검증 대역 서버에서 발급받은 이미지(16바이트) 티켓과 PDF(20바이트) 티켓이 있다
- **행동**: 이미지 티켓에서 `content-type`을 `"application/pdf"`로 바꾼 `PUT`, 본문 길이를 8바이트로 바꾼 `PUT`, PDF 티켓에서 `content-disposition` 헤더를 뺀 `PUT`을 각각 보낸다
- **결과**:
  - `S3-ADP-4.1` `content-type`을 바꾼 `PUT`이 `403`으로 거절되고 대역 버킷에 해당 키가 없다
  - `S3-ADP-4.2` 본문 길이를 바꾼 `PUT`이 `403`으로 거절되고 대역 버킷에 해당 키가 없다
  - `S3-ADP-4.3` `content-disposition`을 뺀 PDF `PUT`이 `403`으로 거절되고 대역 버킷에 해당 키가 없다

</details>

<details>
<summary><strong><code>S3-ADP-5</code></strong> 허용되지 않은 파일 형식이나 최대 크기 초과 파일은 업로드 허가를 받을 수 없다</summary>

- **전제**: `allowedMimeTypes: ["image/png"]`, `maxSize: 1024`로 설정된 `s3Storage` 어댑터가 있다
- **행동**: `mime: "image/jpeg"`(100바이트)과 `mime: "image/png"`(1025바이트)로 각각 `adapter.ticket`을 호출한다
- **결과**:
  - `S3-ADP-5.1` 비허용 MIME 호출이 `BAD_REQUEST` 오류를 던진다
  - `S3-ADP-5.2` 크기 초과 호출이 `BAD_REQUEST` 오류를 던진다

</details>

---

## 2. 파일 상태 조회 (`stat`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-ADP-6</code></strong> 버킷에 올라간 파일의 형식과 크기를 조회한다</summary>

- **전제**: 로컬 S3 대역 서버 버킷에 `"image/webp"` 타입의 32바이트 객체가 UUID `key`로 저장되어 있다
- **행동**: `adapter.stat(key)`를 실행한다
- **결과**:
  - `S3-ADP-6.1` 반환값이 `{ mime: "image/webp", size: 32 }`이다

</details>

<details>
<summary><strong><code>S3-ADP-7</code></strong> 버킷에 없는 파일을 조회하면 없음(null)을 돌려준다</summary>

- **전제**: 로컬 S3 대역 서버 버킷에 해당 UUID `key`의 객체가 없다
- **행동**: `adapter.stat(key)`를 실행한다
- **결과**:
  - `S3-ADP-7.1` 반환값이 `null`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-ADP-8</code></strong> 파일 조회 중 권한 오류가 나면 파일이 없다고 답하지 않고 오류를 던진다</summary>

- **전제**: 로컬 S3 대역 서버가 `HEAD` 요청에 HTTP `403`을 응답하도록 설정되어 있다
- **행동**: `adapter.stat(key)`를 실행한다
- **결과**:
  - `S3-ADP-8.1` 예외가 던져진다

</details>

---

## 3. 공개 주소 생성 (`url`)과 키 안전성

### 핵심 요구사항

<details>
<summary><strong><code>S3-ADP-9</code></strong> 공개 기준 주소와 파일 키를 합친 읽기 주소를 돌려준다</summary>

- **전제**: `publicUrl: "https://cdn.example.com"`으로 설정된 `s3Storage` 어댑터가 있다
- **행동**: `adapter.url("550e8400-e29b-41d4-a716-446655440000")`를 실행한다
- **결과**:
  - `S3-ADP-9.1` 반환값이 `"https://cdn.example.com/550e8400-e29b-41d4-a716-446655440000"`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-ADP-10</code></strong> UUID가 아닌 파일 키로는 어떤 저장소 작업도 실행할 수 없다</summary>

- **전제**: 로컬 S3 대역 서버를 가리키는 `s3Storage` 어댑터가 있다
- **행동**: 키 `"../secret"`으로 `adapter.ticket`, `adapter.stat`, `adapter.url`, `adapter.remove`를 각각 호출한다
- **결과**:
  - `S3-ADP-10.1` `adapter.ticket`이 `BAD_REQUEST` 오류를 던진다
  - `S3-ADP-10.2` `adapter.stat`이 `BAD_REQUEST` 오류를 던진다
  - `S3-ADP-10.3` `adapter.url`이 `BAD_REQUEST` 오류를 던진다
  - `S3-ADP-10.4` `adapter.remove`가 `BAD_REQUEST` 오류를 던진다

</details>

---

## 4. 파일 삭제 (`remove`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-ADP-11</code></strong> 버킷에 있는 파일을 삭제한다</summary>

- **전제**: 로컬 S3 대역 서버 버킷에 UUID `key`로 파일이 저장되어 있다
- **행동**: `adapter.remove(key)`를 실행한다
- **결과**:
  - `S3-ADP-11.1` 삭제 뒤 대역 버킷에 해당 `key`의 객체가 없다

</details>

<details>
<summary><strong><code>S3-ADP-12</code></strong> 이미 없는 파일을 지워도 오류가 나지 않는다</summary>

- **전제**: 로컬 S3 대역 서버가 없는 키의 `DELETE`에 `204`를 주는 기본 모드와 `404 NoSuchKey`를 주는 모드가 각각 있다
- **행동**: 존재하지 않는 UUID `key`로 두 모드에서 각각 `adapter.remove(key)`를 실행한다
- **결과**:
  - `S3-ADP-12.1` `204` 응답에서 오류 없이 종료한다
  - `S3-ADP-12.2` `404 NoSuchKey` 응답에서도 오류 없이 종료한다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-ADP-13</code></strong> 버킷이 없거나 삭제 권한 오류가 나면 성공으로 처리하지 않고 오류를 던진다</summary>

- **전제**: 로컬 S3 대역 서버가 `DELETE` 요청에 `404 NoSuchBucket`을 응답하는 경우와 `403 AccessDenied`를 응답하는 경우가 각각 있다
- **행동**: 두 경우에서 각각 `adapter.remove(key)`를 실행한다
- **결과**:
  - `S3-ADP-13.1` `404 NoSuchBucket` 응답에서 예외가 던져진다
  - `S3-ADP-13.2` `403 AccessDenied` 응답에서 예외가 던져진다

</details>

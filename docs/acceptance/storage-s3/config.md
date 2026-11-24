# `config.ts` 인수 조건

[`docs/refactor/storage-s3.md`](../../refactor/storage-s3.md) 2절(설정과 환경 변수)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `resolveS3Config` | `S3StorageOptions`와 환경 변수(`S3_*`)에서 버킷·인증·공개 URL(끝 `/` 제거)·리전/엔드포인트(`endpoint`만 있으면 `region: "auto"`)·경로 스타일(`"true"`·`"1"`)·티켓 만료 시간·업로드 정책을 해석한다 | 필수 값 누락(공백 포함), `region`·`endpoint` 둘 다 누락, 잘못된 `publicUrl`(거절 오류에 `S3_PUBLIC_URL` 원문·계정 정보 미포함), `ticketSeconds`(1~3600)·`maxSize`(1~`2_147_483_647`) 범위/정수 위반, `allowedMimeTypes` 빈 배열·잘못된 형식 시 `Error` |
| 지연 초기화 (`s3Storage`) | `s3Storage()` 호출 시에는 환경 변수를 읽지 않고, 어댑터 메서드 첫 호출 시 설정을 해석한다 | 첫 호출 시 필수 값 누락 시 누락된 변수 이름을 모두 담은 `Error` |

---

## 1. 환경 변수와 옵션 해석 (`resolveS3Config`)

### 핵심 요구사항

<details>
<summary><strong><code>S3-CFG-1</code></strong> 환경 변수만으로 AWS S3 연결 설정을 읽고 공개 주소 끝의 슬래시를 정리한다</summary>

- **전제**: 앞뒤 공백이 섞인 `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`과 끝에 `/`가 여러 개 붙은 `S3_PUBLIC_URL`이 담긴 `env`가 있다
- **행동**: `resolveS3Config({ env })`를 실행한다
- **결과**:
  - `S3-CFG-1.1` 반환값의 `bucket`, `accessKeyId`, `secretAccessKey`, `region`이 앞뒤 공백이 제거된 환경 변수 값과 같다
  - `S3-CFG-1.2` 반환값의 `publicUrl` 끝의 `/`가 모두 제거되어 있다
  - `S3-CFG-1.3` 반환값의 `endpoint`가 `undefined`, `forcePathStyle`이 `false`, `ticketSeconds`가 `600`이다

</details>

<details>
<summary><strong><code>S3-CFG-2</code></strong> AWS 외 저장소 주소만 주고 지역을 비워 두면 기본 지역(auto)으로 연결한다</summary>

- **전제**: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_ENDPOINT`가 있고 `S3_REGION`은 없는 `env`가 있다
- **행동**: `resolveS3Config({ env })`를 실행한다
- **결과**:
  - `S3-CFG-2.1` 반환값의 `region`이 `"auto"`이다
  - `S3-CFG-2.2` 반환값의 `endpoint`가 `S3_ENDPOINT` 값과 같다

</details>

<details>
<summary><strong><code>S3-CFG-3</code></strong> 코드에서 직접 넘긴 설정이 환경 변수보다 우선한다</summary>

- **전제**: 필수 값과 `S3_FORCE_PATH_STYLE`이 담긴 `env`가 있다
- **행동**: 같은 항목을 다른 값으로 옵션에 함께 넘겨 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-3.1` 반환값의 겹치는 항목이 모두 직접 넘긴 옵션 값과 같다

</details>

<details>
<summary><strong><code>S3-CFG-4</code></strong> 저장소를 만들 때는 환경 변수가 비어 있어도 실패하지 않고 실제 사용 시점에 환경 변수를 한 번만 읽는다</summary>

- **전제**: 처음에는 비어 있는 가변 `env` 객체가 있다
- **행동**: 그 `env`로 `s3Storage({ env })` 어댑터를 만든 뒤, `env`가 빈 상태, 필수 값을 채운 상태, 값을 바꾼 상태에서 차례로 어댑터 메서드를 호출한다
- **결과**:
  - `S3-CFG-4.1` 어댑터 생성은 오류 없이 어댑터 객체를 돌려준다
  - `S3-CFG-4.2` `env`가 빈 상태의 호출은 빠진 필수 환경 변수 이름을 모두 담은 `Error`를 던진다
  - `S3-CFG-4.3` 필수 값을 채운 뒤의 호출은 정상 결과를 돌려준다
  - `S3-CFG-4.4` 첫 성공 뒤 `env`를 바꿔도 처음 해석한 설정으로 결과를 돌려준다

</details>

<details>
<summary><strong><code>S3-CFG-5</code></strong> 환경 변수로 버킷 주소를 경로 방식으로 바꾸는 옵션을 켤 수 있다</summary>

- **전제**: 필수 값과 함께 `S3_FORCE_PATH_STYLE`이 `"true"`인 환경과 `"1"`인 환경이 각각 있다
- **행동**: 두 환경으로 각각 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-5.1` `"true"` 환경에서 반환값의 `forcePathStyle`이 `true`이다
  - `S3-CFG-5.2` `"1"` 환경에서 반환값의 `forcePathStyle`이 `true`이다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>S3-CFG-6</code></strong> 필수 설정 값이 공백뿐이면 비어 있는 것으로 보고 거절한다</summary>

- **전제**: `S3_BUCKET`이 `"   "`이고 나머지 필수 값은 유효한 `env`가 있다
- **행동**: `resolveS3Config({ env })`를 실행한다
- **결과**:
  - `S3-CFG-6.1` `S3_BUCKET`을 포함한 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-7</code></strong> 지역과 저장소 주소가 둘 다 없으면 설정을 거절한다</summary>

- **전제**: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`은 모두 유효하지만 `S3_REGION`과 `S3_ENDPOINT`가 모두 없는 `env`가 있다
- **행동**: `resolveS3Config({ env })`를 실행한다
- **결과**:
  - `S3-CFG-7.1` `S3_REGION`과 `S3_ENDPOINT`를 모두 포함한 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-8</code></strong> 공개 주소가 올바른 HTTP(S) 주소가 아니거나 쿼리·프래그먼트·계정 정보가 들어 있으면 설정을 거절한다</summary>

- **전제**: 나머지 필수 환경 변수는 유효하고, `publicUrl`이 `http://` 주소, HTTP(S)가 아닌 주소, 쿼리나 프래그먼트가 붙은 주소, 계정 정보가 든 주소인 입력이 있다
- **행동**: 각 입력으로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-8.1` `http://` 주소는 정상 통과한다
  - `S3-CFG-8.2` 프로토콜이 없거나 HTTP(S)가 아닌 주소가 `Error`를 던진다
  - `S3-CFG-8.3` 쿼리(빈 `?` 포함)가 붙은 주소가 `Error`를 던진다
  - `S3-CFG-8.4` 프래그먼트(빈 `#` 포함)가 붙은 주소가 `Error`를 던진다
  - `S3-CFG-8.5` 계정 정보가 들어간 주소가 `Error`를 던진다
  - `S3-CFG-8.6` 계정 정보가 든 주소를 거절한 오류의 `message`, `input`, `cause` 사슬 어디에도 주소 원문, 사용자 이름, 비밀번호가 없다

</details>

<details>
<summary><strong><code>S3-CFG-9</code></strong> 업로드 허가 유효 시간이 1초~3600초 범위의 정수가 아니면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: 범위 안팎의 `ticketSeconds`로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-9.1` 범위 끝값 `1`과 `3600`은 정상 통과한다
  - `S3-CFG-9.2` 범위 밖이거나 정수가 아니면 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-10</code></strong> 최대 파일 크기가 1바이트~2,147,483,647바이트 범위의 정수가 아니면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: 범위 안팎의 `maxSize`로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-10.1` 범위 끝값 `1`과 `2_147_483_647`은 정상 통과한다
  - `S3-CFG-10.2` 범위 밖이거나 정수가 아니면 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-11</code></strong> 허용 파일 형식 목록이 비어 있거나 잘못된 형식 문자열을 포함하면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: 비어 있거나 잘못된 항목을 담은 `allowedMimeTypes`로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-11.1` 빈 배열은 `Error`를 던진다
  - `S3-CFG-11.2` 빈 문자열이나 MIME 형식이 아닌 항목(파라미터가 붙은 것 포함)이 들어 있으면 `Error`를 던진다

</details>

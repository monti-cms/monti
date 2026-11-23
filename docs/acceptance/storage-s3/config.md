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

- **전제**: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_REGION`, `S3_FORCE_PATH_STYLE="true"`가 담긴 `env`가 있다
- **행동**: 다른 `bucket`, `region`, `publicUrl`, `forcePathStyle: false`를 옵션으로 함께 넘겨 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-3.1` 반환값의 `bucket`, `region`, `publicUrl`, `forcePathStyle`이 모두 직접 넘긴 옵션 값과 같다

</details>

<details>
<summary><strong><code>S3-CFG-4</code></strong> 저장소를 만들 때는 환경 변수가 비어 있어도 실패하지 않고 실제 사용 시점에 환경 변수를 한 번만 읽는다</summary>

- **전제**: 처음에는 비어 있는 가변 `env` 객체가 있다
- **행동**: 빈 `env`로 `s3Storage({ env })` 어댑터를 만든 뒤, 비어 있는 상태에서 `adapter.url(uuid)`를 호출하고, `env`에 필수 값을 채워 `adapter.url(uuid)`를 호출한 다음, `env.S3_PUBLIC_URL`을 바꿔 한 번 더 호출한다
- **결과**:
  - `S3-CFG-4.1` 빈 `env`로 `s3Storage({ env })` 호출 자체는 오류 없이 어댑터 객체를 돌려준다
  - `S3-CFG-4.2` `env`가 비어 있을 때 `adapter.url(uuid)` 호출이 `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_REGION`, `S3_ENDPOINT`를 모두 포함한 `Error`를 던진다
  - `S3-CFG-4.3` `env`에 필수 값을 채운 뒤 `adapter.url(uuid)`를 호출하면 정상 읽기 주소를 돌려준다
  - `S3-CFG-4.4` 첫 성공 뒤 `env.S3_PUBLIC_URL`을 바꿔도 다시 호출한 `adapter.url(uuid)`가 처음 해석한 주소를 그대로 돌려준다

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

- **전제**: 나머지 필수 환경 변수는 유효하고 `publicUrl`이 각각 `"http://localhost:9000/"`, `"cdn.example.com"`, `"ftp://cdn.example.com"`, `"https://cdn.example.com?a=1"`, `"https://cdn.example.com?"`, `"https://cdn.example.com#top"`, `"https://cdn.example.com#"`, `"https://user@cdn.example.com"`인 입력이 있다
- **행동**: 각 입력으로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-8.1` `http://` 주소는 정상 통과해 `"http://localhost:9000"`을 돌려준다
  - `S3-CFG-8.2` 프로토콜 없는 `"cdn.example.com"`과 `ftp://` 주소가 `Error`를 던진다
  - `S3-CFG-8.3` 쿼리(`?a=1`, 빈 `?`)가 붙은 주소가 `Error`를 던진다
  - `S3-CFG-8.4` 프래그먼트(`#top`, 빈 `#`)가 붙은 주소가 `Error`를 던진다
  - `S3-CFG-8.5` 계정 정보가 들어간 주소가 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-9</code></strong> 업로드 허가 유효 시간이 1초~3600초 범위의 정수가 아니면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: `ticketSeconds`를 경계값(`1`, `3600`)과 범위 밖(`0`, `1.5`, `3601`)으로 각각 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-9.1` `1`과 `3600`은 정상 통과한다
  - `S3-CFG-9.2` `ticketSeconds: 0` 호출이 `Error`를 던진다
  - `S3-CFG-9.3` `ticketSeconds: 1.5` 호출이 `Error`를 던진다
  - `S3-CFG-9.4` `ticketSeconds: 3601` 호출이 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-10</code></strong> 최대 파일 크기가 1바이트~2,147,483,647바이트 범위의 정수가 아니면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: `maxSize`를 경계값(`1`, `2_147_483_647`)과 범위 밖(`0`, `10.5`, `2_147_483_648`)으로 각각 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-10.1` `1`과 `2_147_483_647`은 정상 통과한다
  - `S3-CFG-10.2` `maxSize: 0` 호출이 `Error`를 던진다
  - `S3-CFG-10.3` `maxSize: 10.5` 호출이 `Error`를 던진다
  - `S3-CFG-10.4` `maxSize: 2_147_483_648` 호출이 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-11</code></strong> 허용 파일 형식 목록이 비어 있거나 잘못된 형식 문자열을 포함하면 설정을 거절한다</summary>

- **전제**: 필수 환경 변수가 모두 담긴 `env`가 있다
- **행동**: `allowedMimeTypes`를 `[]`, `[""]`, `["image/png; charset=utf-8"]`, `["bad image/png"]`로 하여 각각 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-11.1` 빈 배열 `[]` 호출이 `Error`를 던진다
  - `S3-CFG-11.2` 빈 문자열이 든 배열 `[""]` 호출이 `Error`를 던진다
  - `S3-CFG-11.3` 파라미터나 앞쪽 잘못된 문자가 붙은 항목이 `Error`를 던진다

</details>

<details>
<summary><strong><code>S3-CFG-12</code></strong> 공개 주소가 거절될 때 오류 메시지와 오류 객체에 계정 정보나 주소 원문이 노출되지 않는다</summary>

- **전제**: 나머지 필수 환경 변수는 유효하다. `S3_PUBLIC_URL`이 `"https://user:s3cret@cdn.example.com"`인 입력과, 파싱되지 않는 `"https://user:s3cret@"`인 입력이 있다
- **행동**: 각 입력으로 `resolveS3Config`를 실행한다
- **결과**:
  - `S3-CFG-12.1` 계정 정보가 있는 주소는 `S3_PUBLIC_URL`을 포함한 `Error`를 던진다
  - `S3-CFG-12.2` 파싱되지 않는 주소도 `S3_PUBLIC_URL`을 포함한 `Error`를 던진다
  - `S3-CFG-12.3` 두 오류의 `message`, `input`, `cause` 체인에 `"s3cret"`과 입력 URL 원문이 없다

</details>

# `@monti-cms/storage-s3` 개발 기준

이 문서는 `@monti-cms/storage-s3`(`packages/storage-s3`)를 개발할 때 따르는 기준이다. `core`의 `StorageAdapter` 계약과 미디어·임시 파일(`loose_files`) 규칙은 [core.md](core.md)를 따른다.

## 1. 경계와 원칙

판단 기준은 하나다. **"S3 호환 객체 저장소(AWS S3, Cloudflare R2, MinIO)에서 `core`의 `StorageAdapter` 계약을 안전하게 구현하는 데 필요한가?"**

**`storage-s3`가 하는 일**
- `@monti-cms/core`의 `StorageAdapter`(`ticket`, `stat`, `url`, `remove`) 구현체를 `s3Storage(options?)`로 제공한다.
- **지연 설정 해석**: `s3Storage()` 호출 시점이 아니라 어댑터 메서드가 처음 호출될 때 옵션과 환경 변수(`S3_*`)를 읽어 `S3Client`를 한 번만 초기화한다(자격 증명 없이도 사이트 빌드가 성공한다).
- **업로드 정책 검증**: `ticket` 발급 전 소문자 UUID 키, 허용 MIME 타입, 최대 파일 크기를 검사해 위반 시 `@monti-cms/core`의 `MontiError("BAD_REQUEST", ...)`로 거절한다.
- **1회용 직접 업로드 서명 (`ticket`)**: 브라우저가 서버를 거치지 않고 버킷에 `PUT`할 수 있도록 `content-type`, `content-length`, `cache-control`, `if-none-match: *`, 필요 시 `content-disposition`까지 서명한 URL과 업로드 헤더를 반환한다.
- **읽기 주소(`url`)·상태 조회(`stat`)·멱등 삭제(`remove`)**: 공개 버킷/CDN 읽기 URL을 조합하고, `HEAD`로 업로드 완료된 파일의 MIME·크기를 조회하며, `DELETE`에서 `204` 또는 정확한 `NoSuchKey`만 성공으로 보고 `NoSuchBucket`(404)·권한·서버·네트워크 오류는 그대로 올린다.

**`storage-s3`가 하지 않는 일**
- 구버전 `Storage`의 `put`, `read`, `readStart`, `copy` 및 `sealed`/`ticket_size`/파일 재복사 경로 복원(고아 파일 정리는 `core`의 `loose_files` + `removeLooseFiles` 계약이 맡는다).
- `localFolderStorage` 같은 로컬 디스크 대체 구현 또는 저장소 미설정 시 자동 로컬 폴백.
- 옛 `Plugin.storage` 슬롯 연결(연결은 항상 `monti.config.ts`의 최상위 `storage: s3Storage()`로 한다).
- 비공개 버킷의 읽기마다 서명 URL 발급(공개 버킷 또는 앞단 CDN을 전제로 한다).
- 파일 바이트 스니핑(서명은 선언된 `Content-Type`과 바이트 길이를 고정하며, Monti 전용 버킷과 앱과 격리된 공개 미디어 origin 사용을 운영 전제로 한다).
- `monti init` / `monti doctor` CLI 명령 구현(CLI 2단계 범위다).

## 2. 설정과 환경 변수

모든 연결 값은 `s3Storage(options)`에 직접 줄 수 있고, 생략(`undefined`)하면 `options.env ?? process.env`에서 읽는다. 앞뒤 공백은 제거하며 공백뿐인 문자열은 누락으로 취급한다. 테스트 주입성을 위해 `packages/cli`와 동일하게 `env` 객체를 주입받으며 `env.d.ts`는 두지 않는다(환경 변수 이름은 `config.ts`의 명시적 상수로만 조회한다).

| 옵션 키 | 환경 변수 | 필수 여부 | 설명 |
|---|---|---|---|
| `bucket` | `S3_BUCKET` | 필수 | 버킷 이름 |
| `accessKeyId` | `S3_ACCESS_KEY_ID` | 필수 | 접근 키 ID(고정 자격 증명 기준) |
| `secretAccessKey` | `S3_SECRET_ACCESS_KEY` | 필수 | 비밀 접근 키 |
| `publicUrl` | `S3_PUBLIC_URL` | 필수 | 공개 버킷 또는 CDN 기준 주소(`http:`/`https:` 절대 URL, 쿼리·프래그먼트·계정 정보 금지, 끝 `/` 제거). 파일 주소는 `<publicUrl>/<key>` |
| `region` | `S3_REGION` | 조건부 필수 | AWS 리전. `endpoint`가 있고 `region`이 없으면 `"auto"`(R2 기본값) |
| `endpoint` | `S3_ENDPOINT` | 조건부 필수 | AWS 외 S3 호환 저장소 주소(R2·MinIO). `region`과 `endpoint` 둘 다 없으면 오류 |
| `forcePathStyle` | `S3_FORCE_PATH_STYLE` | 선택 | `true`면 버킷을 경로에 둔다(MinIO, 점 포함 버킷). 환경 변수는 `"true"` 또는 `"1"`일 때 `true` |
| `ticketSeconds` | — | 선택 | 서명된 업로드 URL 만료 시간(초). 기본 `600`, 허용 범위 `1`~`3600`(정수). `core`의 `loose_files` 24시간 대기보다 항상 짧게 유지한다 |
| `allowedMimeTypes` | — | 선택 | 허용 MIME 타입 목록(비어 있지 않은 배열, 각 항목은 파라미터 없는 `type/subtype` 문자열, 소문자 정규화). 생략 시 기본 안전 목록 사용 |
| `maxSize` | — | 선택 | 최대 업로드 바이트 크기. 기본 `10 * 1024 * 1024`(10 MiB), 허용 범위 `1`~`2_147_483_647`(정수, `core` DB `media.size` PostgreSQL `integer` 상한) |
| `env` | — | 선택 | 환경 변수 조회 대상 객체(기본 `process.env`, 테스트 주입용) |

- 필수 연결 값이 하나라도 빠지면 첫 메서드 호출 시 빠진 환경 변수 이름을 모두 담은 `Error`를 던진다(`region`과 `endpoint`가 둘 다 빠지면 `S3_REGION`과 `S3_ENDPOINT`를 함께 표기한다). 설정 오류이므로 `MontiError("BAD_REQUEST")`가 아니다.
- `S3Client`는 R2·MinIO 호환을 위해 `requestChecksumCalculation: "WHEN_REQUIRED"`, `responseChecksumValidation: "WHEN_REQUIRED"`를 지정한다.

## 3. 보안·업로드 정책

1. **키 검증 (`assertSafeKey`)**: `ticket`, `stat`, `url`, `remove` 모두 실행 전에 `key`를 검사한다.
   - 허용: 소문자 UUID 형식(`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`, `core`의 `media.startUpload`가 `randomUUID()`로 만드는 형식과 정확히 일치).
   - 거절: UUID가 아닌 모든 문자열(빈 문자열, 경로 구분자, `..`, `index.html`, 대문자 UUID 등)은 `MontiError("BAD_REQUEST", ...)`로 거절해 같은 버킷의 타 파일 오등록·오삭제를 막는다.
2. **기본 허용 MIME 목록 (`DEFAULT_ALLOWED_MIME_TYPES`)**:
   - 이미지: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`
   - 문서: `application/pdf`, `text/plain`, `text/csv`
   - 영상: `video/mp4`, `video/webm`
   - 오디오: `audio/mpeg`, `audio/wav`, `audio/ogg`
   - 압축: `application/zip`
   - `image/svg+xml`, `text/html`, `application/xhtml+xml` 등 스크립트가 실행될 수 있는 형식은 기본 목록에서 제외한다.
   - 요청 MIME과 사용자가 지정한 `allowedMimeTypes` 항목 모두 소문자로 정규화해 정확히 일치하는지 확인하며, `; charset=...` 같은 파라미터가 붙은 문자열은 허용하지 않는다.
3. **크기 제한**: `core`의 `media.startUpload`는 `size >= 0`을 통과시키지만, 이 어댑터는 빈 파일 업로드를 막기 위해 `1` 이상 `maxSize`(기본 10 MiB, 최대 `2_147_483_647`) 이하의 정수만 허용한다. 위반 시 `MontiError("BAD_REQUEST", ...)`.
4. **캐시·표시·1회용 덮어쓰기 방지 헤더**:
   - 모든 업로드에 `Cache-Control: public, max-age=31536000, immutable`을 부여하고 서명에 포함한다.
   - 이미 등록된 키가 만료 전 티켓 재사용으로 덮어써져 `immutable` 캐시와 원본이 어긋나는 것을 막기 위해 `If-None-Match: *`를 `PutObjectCommand`와 반환 `headers`에 포함한다(AWS S3·Cloudflare R2·최신 MinIO 지원). 단, 이미 올라간 키가 영구 삭제되어 버킷에서 사라진 뒤 만료 전 재업로드되는 경우는 조건부 쓰기 범위 밖이다.
   - `image/*` 중 `image/svg+xml`을 제외한 이미지는 `Content-Disposition`을 생략해 브라우저에서 바로 표시한다. 그 외 모든 형식과 `image/svg+xml`(사용자가 커스텀 허용한 경우 포함)은 `Content-Disposition: attachment`를 부여한다.
   - AWS SDK v3 presigner가 기본 비서명 대상으로 빼는 `content-type`·`cache-control`은 `signableHeaders`에 명시해 서명에 포함하고, `content-length`·`if-none-match`·`content-disposition`은 `PutObjectCommand` 설정으로 기본 서명된다(`X-Amz-SignedHeaders`로 검증). `Content-Length`는 브라우저 `fetch` 금지 헤더이므로 반환 `headers` 객체에는 넣지 않는다.
   - 브라우저 직접 업로드를 위해 버킷 CORS의 `AllowedMethods`에 `PUT`, `AllowedHeaders`에 `content-type`, `cache-control`, `content-disposition`, `if-none-match`가 필요하다.

## 4. `StorageAdapter` 동작 요약

| 메서드 | S3 호출 | 반환 / 오류 처리 |
|---|---|---|
| `ticket(key, { mime, size })` | `getSignedUrl(PutObjectCommand)` | `{ url, headers }` 반환. `headers`는 `content-type`, `cache-control`, `if-none-match`, 비이미지·SVG면 `content-disposition`. 정책·키 위반 시 `BAD_REQUEST` |
| `stat(key)` | `HeadObjectCommand` | `{ mime, size }` 반환(`ContentType` 생략 시 `"application/octet-stream"`, `ContentLength` 생략 시 `0`). `HEAD` 404 응답(SDK가 본문 없는 404를 `NotFound`로 통일)이면 `null`(유효한 버킷과 AWS `s3:ListBucket` 권한이 운영 전제), 그 외 오류는 그대로 throw |
| `url(key)` | 없음 | `${publicUrl}/${key}` 반환 |
| `remove(key)` | `DeleteObjectCommand` | 성공(`204`) 또는 오류 이름이 정확히 `NoSuchKey`일 때만 `void`. `NoSuchBucket`(404)·권한(403)·서버·네트워크 오류는 그대로 throw |

## 5. 폴더 구조와 코드 규칙

`core`, `cli`와 동일하게 단방향 층 구조, 함수 본문 30줄 제한, `types.ts` 타입 전용 규칙, `agent-guard` 펜스를 적용한다.

```text
packages/storage-s3/src/
├── types.ts                [타입] S3StorageOptions, ResolvedS3Config, UploadPolicy
├── policy.ts               [함수] 층 0: UUID 키 검증, 기본 허용 MIME·크기 상수, 업로드 정책 검증, 헤더 정책
├── config.ts               [함수] 층 1: 옵션·환경 변수 해석, URL·상한 검증, S3Client 지연 생성
├── adapter.ts              [함수] 층 2: StorageAdapter(ticket, stat, url, remove) 구현, S3 오류 판별
├── index.ts                [공개 API] s3Storage, S3StorageOptions, DEFAULT_ALLOWED_MIME_TYPES, DEFAULT_MAX_SIZE
└── __test__/
    └── fake-s3.ts          [테스트 도우미] 실제 HTTP 요청과 AWS SigV4 서명·조건부 쓰기(`If-None-Match`)를 검증하는 로컬 S3 대역 서버
```

- **단방향 의존**: `types.ts` ← `policy.ts` ← `config.ts` ← `adapter.ts` ← `index.ts`. 순환 참조 금지.
- **패키지 의존성**: `@monti-cms/core`는 `peerDependencies`로 선언해(`cli`와 동일) 모듈 이중 로딩으로 인한 오류 판별 문제를 방지한다. DB 의존성은 두지 않는다.
- **테스트 방식**: `@aws-sdk/client-s3`를 모킹하지 않고, `node:http` 기반 로컬 S3 대역 서버(`src/__test__/fake-s3.ts`)에 실제 `S3Client`·`getSignedUrl`·`fetch`로 요청해 SigV4 서명·조건부 쓰기(`If-None-Match: *`)·헤더·상태 코드·오류 전파를 검증한다. `core`·PostgreSQL과의 결합 테스트는 상위 패키지(`next`·`cli`·앱 E2E)에서 담당한다.

## 6. 작업 단계

1. **설계·AC 승인**: `docs/refactor/storage-s3.md`와 `docs/acceptance/storage-s3/`(`config.md`, `policy.md`, `adapter.md`) 승인 완료.
2. **기반 세팅**: `packages/storage-s3` 린트·의존성·미사용·중복·테스트·Stryker 설정 및 루트 `package.json` 연결 완료.
3. **구현·검증**: AC 테스트 선작성 → `types.ts`·`policy.ts`·`config.ts`·`adapter.ts`·`index.ts` 구현 → `README.md`·`README.ko.md` 현행화 → `agent-guard`·린트·가로세로 리뷰·Stryker 마무리.

# @monti-cms/storage-s3

[English](README.md) | 한국어

`@monti-cms/core`의 미디어 저장소로, S3 API를 쓰는 **AWS S3**, **Cloudflare R2**, **MinIO**를 지원한다. `@aws-sdk/client-s3`와 `@aws-sdk/s3-request-presigner`를 직접 의존하므로 미디어를 쓰는 사이트만 SDK를 설치한다. 코어에는 미디어 어댑터 인터페이스(`@monti-cms/core/server`의 `MediaAdapter`, `MediaStore`)만 남는다. 이후의 저장소(Vercel Blob, 로컬 디스크 저장소)도 같은 모양의 다른 패키지로 만든다.

업로드는 브라우저가 서명된 주소로 버킷에 바로 올린다. 그다음 서버가 파일을 검사하고 `staging/`에서 최종 키로 옮겨 공개 주소로 서빙한다.

## 설치

```sh
pnpm add @monti-cms/storage-s3
```

`@monti-cms/core`는 peer다.

## 사용

```ts
// cms.server.ts
import { r2Storage } from "@monti-cms/storage-s3";

defineServerConfig({
	// …
	media: r2Storage(), // 아래 R2_* 변수를 읽는다
});
```

인자 없이 쓰면 환경 변수를 읽고, 옵션을 주면 옵션이 우선한다. 값은 처음 쓸 때 읽으므로 빌드 중에는 비어 있어도 된다. 빠진 값이 있으면 변수 이름을 담은 오류가 난다(`r2Storage: R2_BUCKET is not set ...`).

### Cloudflare R2: `r2Storage()`

| 변수 | 옵션 | 의미 |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | `accountId` | Cloudflare 계정 ID. 엔드포인트는 `https://<id>.r2.cloudflarestorage.com` |
| `R2_ENDPOINT` | `endpoint` | 계정 ID 대신 쓴다(EU 같은 관할 엔드포인트) |
| `R2_BUCKET` | `bucket` | 버킷 이름 |
| `R2_ACCESS_KEY_ID` | `accessKeyId` | R2 API 토큰의 액세스 키 ID |
| `R2_SECRET_ACCESS_KEY` | `secretAccessKey` | R2 API 토큰의 시크릿 |
| `R2_PUBLIC_URL` | `publicBaseUrl` | 파일 공개 주소의 앞부분: 커스텀 도메인 또는 `r2.dev` 주소 |

리전은 항상 `auto`다. `R2_ACCOUNT_ID`와 `R2_ENDPOINT` 중 하나면 된다.

### AWS S3, MinIO 등: `s3Storage()`

| 변수 | 옵션 | 의미 |
| --- | --- | --- |
| `S3_REGION` | `region` | 버킷 리전, 예: `ap-northeast-2` |
| `S3_ENDPOINT` | `endpoint` | S3 API 주소. AWS에서는 생략 가능(기본 `https://s3.<region>.amazonaws.com`), MinIO에서는 필수 |
| `S3_BUCKET` | `bucket` | 버킷 이름 |
| `S3_ACCESS_KEY_ID` | `accessKeyId` | 액세스 키 ID |
| `S3_SECRET_ACCESS_KEY` | `secretAccessKey` | 시크릿 액세스 키 |
| `S3_PUBLIC_URL` | `publicBaseUrl` | 파일 공개 주소의 앞부분: CDN 또는 공개 버킷 주소 |
| `S3_FORCE_PATH_STYLE` | `forcePathStyle` | 경로 방식 주소(`<endpoint>/<bucket>/<key>`)를 쓰려면 `true`. MinIO에 필요 |

```ts
media: s3Storage(), // AWS: S3_REGION 등을 .env.local에서 읽는다
media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true }), // MinIO
```

파일은 공개 주소에서 읽을 수 있어야 하고, 브라우저 업로드를 위해 버킷에 사이트에서 오는 `PUT`을 허용하는 CORS 규칙이 필요하다.

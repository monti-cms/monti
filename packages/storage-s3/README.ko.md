# @monti-cms/storage-s3

[English](README.md) | 한국어

AWS S3 및 S3 호환 객체 저장소(Cloudflare R2, MinIO)용 Monti 미디어 `StorageAdapter`입니다.

```ts
// monti.config.ts
import type { MontiConfig } from "@monti-cms/core";
import { s3Storage } from "@monti-cms/storage-s3";

export default {
	name: "My Site",
	storage: s3Storage(),
} satisfies MontiConfig;
```

## 설정

연결 값은 어댑터를 처음 사용할 때 지연 로딩하므로 자격 증명 없이도 사이트 빌드가 성공합니다. 각 값은 `s3Storage({ ... })`에 직접 넘기거나 환경 변수로 줄 수 있으며, 직접 넘긴 옵션이 환경 변수보다 우선합니다.

| 옵션 | 환경 변수 | 필수 여부 | 설명 |
|---|---|---|---|
| `bucket` | `S3_BUCKET` | 필수 | 버킷 이름 |
| `accessKeyId` | `S3_ACCESS_KEY_ID` | 필수 | 접근 키 ID(고정 자격 증명) |
| `secretAccessKey` | `S3_SECRET_ACCESS_KEY` | 필수 | 비밀 접근 키 |
| `publicUrl` | `S3_PUBLIC_URL` | 필수 | 공개 버킷 또는 CDN 기준 주소(`http:`/`https:`, 쿼리·프래그먼트·계정 정보 금지). 파일 주소는 `<publicUrl>/<key>` |
| `region` | `S3_REGION` | 조건부 필수 | AWS 리전. `endpoint`가 있고 생략하면 `"auto"`(Cloudflare R2) |
| `endpoint` | `S3_ENDPOINT` | 조건부 필수 | AWS 외 S3 API 주소(R2, MinIO). `region`과 `endpoint` 중 하나는 필수 |
| `forcePathStyle` | `S3_FORCE_PATH_STYLE` | 선택 | 버킷을 호스트 대신 경로에 둠(환경 변수 `"true"` 또는 `"1"`; MinIO 또는 이름에 `.`이 든 버킷에 필요) |
| `ticketSeconds` | — | 선택 | 서명된 `PUT` 주소 유효 시간(초, `1`~`3600`, 기본 `600`, core의 24시간 `loose_files` 대기보다 짧게 유지) |
| `allowedMimeTypes` | — | 선택 | 허용 MIME 목록(비어 있지 않은 배열, 대소문자 무관, 파라미터 금지). 기본값은 `DEFAULT_ALLOWED_MIME_TYPES` |
| `maxSize` | — | 선택 | 최대 업로드 크기(바이트, `1`~`2_147_483_647`, 기본 `10 * 1024 * 1024` / 10 MiB) |
| `env` | — | 선택 | 환경 변수 조회 대상 객체(기본 `process.env`) |

기본 허용 MIME 목록을 확장해 쓰려면:

```ts
import { DEFAULT_ALLOWED_MIME_TYPES, s3Storage } from "@monti-cms/storage-s3";

export const storage = s3Storage({
	allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES, "image/heic"],
	maxSize: 50 * 1024 * 1024,
});
```

## 보안과 업로드 흐름

- **브라우저 직접 업로드**: `media.startUpload`가 `storage.ticket(key, { mime, size })`를 호출해 키, `Content-Type`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable`, `If-None-Match: *`(기존 키 덮어쓰기 방지), 비이미지·SVG용 `Content-Disposition: attachment`를 서명한 `PUT` 주소를 발급합니다.
- **UUID 전용 키**: 모든 메서드(`ticket`, `stat`, `url`, `remove`)는 `core`의 `media.startUpload`가 생성하는 소문자 UUID 키만 허용해 버킷의 다른 파일을 보호합니다.
- **기본 MIME 정책**: 안전한 이미지(`jpeg`, `png`, `webp`, `gif`, `avif`), 문서(`pdf`, `plain`, `csv`), 영상(`mp4`, `webm`), 오디오(`mpeg`, `wav`, `ogg`), `zip`을 허용하며 `image/svg+xml`과 `text/html`은 기본 제외합니다.
- **공개 도메인 격리**: Monti 전용 버킷을 사용하고, 사이트와 쿠키를 공유하지 않는 도메인으로 파일을 서빙하세요.
- **멱등 삭제**: `remove(key)`는 `204` 또는 정확한 `NoSuchKey`일 때만 성공으로 처리하며, `NoSuchBucket`·권한(`403`)·네트워크 오류는 그대로 올려 `core`의 `removeLooseFiles`가 재시도할 수 있게 합니다.
- **AWS S3 권한**: 없는 키에 대한 `HeadObject`가 `403` 대신 `404`(`null`)로 응답하려면 `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` 외에 버킷에 `s3:ListBucket` 권한이 필요합니다.

## 버킷 CORS

관리자 화면 주소에서 버킷으로 `PUT`할 수 있도록 CORS를 설정하세요(MinIO Community는 버킷별 CORS 대신 서버 환경 변수 `MINIO_API_CORS_ALLOW_ORIGIN`을 사용합니다).

```json
[
  {
    "AllowedOrigins": ["https://your.site"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "cache-control", "content-disposition", "if-none-match"],
    "MaxAgeSeconds": 3600
  }
]
```

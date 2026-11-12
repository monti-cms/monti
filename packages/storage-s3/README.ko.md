# @monti-cms/storage-s3

[English](README.md) | 한국어

Monti의 미디어 파일을 S3나 그 API를 말하는 저장소에 둡니다: AWS S3, Cloudflare R2, MinIO.

```ts
// monti.config.ts
import { defineConfig, definePlugin } from "@monti-cms/core";
import { s3Storage } from "@monti-cms/storage-s3";

export default defineConfig({
	// …
	plugins: [definePlugin({ name: "files", storage: s3Storage() })],
});
```

`npx monti init --storage s3`가 이 설정을 쓰고, 아래 이름들을 `.env.local`에 넣어 줍니다.

## 값

저장소를 처음 쓸 때 환경에서 읽습니다(값 없이도 사이트는 빌드됩니다). 하나씩 `s3Storage({ … })`에 직접 줄 수도 있습니다. 빠진 값은 그 이름을
말하는 오류가 됩니다.

| 이름 | 무엇인가 |
|---|---|
| `S3_BUCKET` | 버킷 |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | 사이트가 버킷을 읽고 쓰는 키 |
| `S3_PUBLIC_URL` | 파일이 보이는 주소의 앞부분. 공개 버킷이나 그 앞의 CDN입니다. 파일의 주소는 `<이 값>/<키>`입니다 |
| `S3_REGION` | 지역. AWS에 씁니다. 주소(`S3_ENDPOINT`)가 있고 지역이 없으면 `auto`입니다(R2의 지역) |
| `S3_ENDPOINT` | AWS가 아닌 저장소의 주소. R2는 `https://<계정>.r2.cloudflarestorage.com` |
| `S3_FORCE_PATH_STYLE` | `true`면 버킷을 호스트 이름이 아니라 경로에 둡니다(MinIO) |

- 파일은 주소를 아는 누구나 읽습니다. 버킷이 공개이거나 그 앞에 CDN이 있습니다. 파일마다 권한(ACL)을 붙이지 않습니다(R2는 받지 않습니다).
  누가 읽을 수 있는지는 버킷의 설정입니다. 읽을 때마다 서명하는 비공개 버킷은 지원하지 않습니다.
- 키는 한 번 쓰이고 바뀌지 않으므로, 파일은 `Cache-Control: public, max-age=31536000, immutable`로 올라갑니다.

## 파일은 버킷으로 곧장 올라갑니다

호스트가 받는 요청의 크기가 Monti가 받는 가장 큰 파일(10 MB)보다 작을 수 있습니다(서버리스 함수는 흔히 4.5 MB에서 멈춥니다). 그래서 파일의
바이트는 사이트를 지나지 않습니다.

1. 관리자 화면이 사이트에 올리기 표를 청합니다. 파일의 이름, 크기, 앞부분을 보냅니다. 사이트는 미디어 라이브러리의 규칙으로 그것을 보고,
   키를 정하고, 그 키 · 그 종류 · 그 크기의 `PUT` 한 번에만 서명된 주소를 줍니다.
2. 브라우저가 그 주소로 파일을 보냅니다.
3. 관리자 화면이 사이트에 알립니다. 사이트는 버킷에 든 것을 직접 봅니다: 크기와 앞부분을 같은 규칙으로. 표와 다른 파일은 지우고 거절합니다.
   이 확인을 지나기 전에는 어떤 항목도 그 파일을 가리키지 않습니다.

올라갔지만 항목이 되지 않은 파일은, 다른 길로 올린 것과 같이 치워집니다.

## 버킷의 CORS

버킷은 관리자 화면을 여는 주소마다 `PUT`을 받아야 합니다. 개발할 때의 `http://localhost:3000`도 그렇습니다. `npx monti doctor --origin
https://your.site`가 브라우저처럼 버킷에 묻고, 안 된다고 하면 붙여 넣을 설정을 찍습니다.

```json
[
  {
    "AllowedOrigins": ["https://your.site"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "MaxAgeSeconds": 3600
  }
]
```

## 해 본 것

테스트는 이 패키지 안의 대역 버킷(`src/__test__/fake-s3.ts`)에서 돕니다. 대역은 서명된 주소를 S3 문서가 적은 대로 확인합니다. 실제 버킷은 아직
써 보지 않았습니다: AWS S3, R2, MinIO 모두, 그리고 다른 주소에서 브라우저가 올리는 것도 해 보지 않았습니다.

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
- 그림이 아닌 파일은 `Content-Disposition: attachment`로 저장됩니다. 그 주소를 열면 화면에 그려지지 않고 내려받아집니다. 버킷은 사이트의
  파일 경로가 붙이는 머리글(`nosniff`, 샌드박스) 없이 제 주소로 파일을 내주므로, PDF나 글 파일이 거기서 페이지로 열리면 안 됩니다. 그림은
  제자리에 보입니다. 라이브러리는 SVG와 HTML을 받지 않으므로, 그림 가운데 무엇을 실행할 수 있는 것은 없습니다.
- **파일의 주소는 사이트와 쿠키를 나누지 않는 주소로 두세요.** 버킷이나 CDN의 제 도메인이 맞고, 사이트의 하위 도메인(`example.com` 옆의
  `files.example.com`)은 아닙니다. 앞에 둔 CDN은 `X-Content-Type-Options: nosniff`를 붙일 수 있지만 버킷은 못 합니다.

## 파일은 버킷으로 곧장 올라갑니다

호스트가 받는 요청의 크기가 Monti가 받는 가장 큰 파일(10 MB)보다 작을 수 있습니다(서버리스 함수는 흔히 4.5 MB에서 멈춥니다). 그래서 파일의
바이트는 사이트를 지나지 않습니다.

1. 관리자 화면이 사이트에 올리기 표를 청합니다. 파일의 이름, 크기, 앞부분을 보냅니다. 사이트는 미디어 라이브러리의 규칙으로 그것을 보고,
   키를 정하고, 그 키 · 그 종류 · 그 크기의 `PUT` 한 번에만 서명된 주소를 줍니다.
2. 브라우저가 그 주소로 파일을 보냅니다.
3. 관리자 화면이 사이트에 알립니다. 사이트는 그 파일을 버킷 안에서 새 키로 복사합니다. 어떤 주소도 서명된 적 없는 키입니다. 그리고 그 복사본을
   봅니다: 크기는 표의 크기여야 하고, 앞부분이 말하는 종류는 같은 규칙으로 표의 종류여야 합니다. 표와 다른 파일은 지우고 거절합니다.
   라이브러리는 이렇게 확인된 키로만 항목을 만듭니다.

서명된 주소는 10분 동안, 한 번이 아니라 여러 번 쓸 수 있습니다. 같은 주소로 다시 `PUT`하면 버킷은 받습니다. 그것은 옛 키에 쓰이고, 그 키는
이제 아무것도 가리키지 않습니다. 확인된 복사본은 그대로이고, 다시 쓰인 것은 치우기가 지웁니다.

올라갔지만 항목이 되지 않은 파일은, 다른 길로 올린 것과 같이 치워집니다.

## 버킷의 CORS

버킷은 관리자 화면을 여는 주소마다 `PUT`을 받아야 합니다. 개발할 때의 `http://localhost:3000`도 그렇습니다. `npx monti doctor --origin
https://your.site`가 브라우저처럼 버킷에 묻고, 안 된다고 하면 붙여 넣을 설정을 찍습니다.

```json
[
  {
    "AllowedOrigins": ["https://your.site"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "cache-control", "content-disposition"],
    "MaxAgeSeconds": 3600
  }
]
```

## 해 본 것

테스트는 이 패키지 안의 대역 버킷(`src/__test__/fake-s3.ts`)에서 돕니다. 대역은 모든 요청의 서명을 S3 문서가 적은 대로 다시 계산하고, 기한이
지난 주소와 서명에 없던 값이 붙은 주소를 거절하고, 쓴 주소로 다시 온 `PUT`은 S3처럼 받습니다. 실제 버킷으로는 Cloudflare R2에서
해 봤습니다(2026-11-13, `scripts/try-s3.mjs`): 아래의 것이 모두 맞았고, 버킷의 CORS 답도 맞았습니다. AWS S3와 MinIO는 해 보지 않았고,
브라우저가 직접 올리는 것도 해 보지 않았습니다(시험은 브라우저가 먼저 묻는 것을 버킷에 묻습니다).

저장소의 `node scripts/try-s3.mjs`가 같은 것을 실제 버킷에서 해 봅니다. 위의 값들을 환경에서 읽고, CORS 점검에는 `TRY_S3_ORIGIN`을 씁니다.
키와 서명된 주소는 찍지 않고, 만든 것은 지웁니다.

# @monti-cms/storage-s3

English | [한국어](README.ko.md)

Media storage for `@monti-cms/core` on the S3 API: **AWS S3**, **Cloudflare R2** and **MinIO** (one function, `s3Storage()`). It depends on `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` itself, so only sites that use media install the SDK. The core keeps only the media adapter interface (`MediaAdapter`, `MediaStore` from `@monti-cms/core/server`); a later store (Vercel Blob, a local disk store) is another package of the same shape.

Uploads go straight from the browser to the bucket through a presigned URL. The server then checks the file, moves it from `staging/` to its final key and serves it from the public URL.

## Install

```sh
pnpm add @monti-cms/storage-s3
```

`@monti-cms/core` is a peer.

## Use

```ts
// monti.config.ts
import { s3Storage } from "@monti-cms/storage-s3";

export const cms = defineConfig({
	// …
	storage: s3Storage(), // reads the S3_* variables below
});
```

With no arguments the store reads the environment variables. Options override them, each one on its own (pass some, and the rest still come from the environment). The values are read on first use, so they may be empty while building; a missing one fails with an error that names the variable and says it can be passed explicitly (`` `S3_BUCKET` is empty; set it, or pass `s3Storage({ bucket })` ``). One function, one prefix (`S3_*`).

### Variables

| Variable | Option | Meaning |
| --- | --- | --- |
| `S3_REGION` | `region` | Bucket region, e.g. `ap-northeast-2` |
| `S3_ENDPOINT` | `endpoint` | S3 API URL. Optional on AWS (defaults to `https://s3.<region>.amazonaws.com`), required for MinIO |
| `S3_BUCKET` | `bucket` | Bucket name |
| `S3_ACCESS_KEY_ID` | `accessKeyId` | Access key ID |
| `S3_SECRET_ACCESS_KEY` | `secretAccessKey` | Secret access key |
| `S3_PUBLIC_URL` | `publicBaseUrl` | Public start of file URLs: a CDN or the public bucket URL |
| `S3_FORCE_PATH_STYLE` | `forcePathStyle` | `true` for path-style URLs (`<endpoint>/<bucket>/<key>`), needed by MinIO |

### Cloudflare R2

R2 speaks the S3 API, so it is the same function:

```sh
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
```

### MinIO

```sh
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
```

(or as options: `s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true })`).

The files must be publicly readable at the public URL, and the bucket needs a CORS rule that allows `PUT` from your site for the browser upload.

# @monti-cms/storage-s3

English | [한국어](README.ko.md)

Media storage for `@monti-cms/core` on the S3 API: **AWS S3**, **Cloudflare R2** and **MinIO**. It depends on `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` itself, so only sites that use media install the SDK. The core keeps only the media adapter interface (`MediaAdapter`, `MediaStore` from `@monti-cms/core/server`); a later store (Vercel Blob, a local disk store) is another package of the same shape.

Uploads go straight from the browser to the bucket through a presigned URL. The server then checks the file, moves it from `staging/` to its final key and serves it from the public URL.

## Install

```sh
pnpm add @monti-cms/storage-s3
```

`@monti-cms/core` is a peer.

## Use

```ts
// cms.server.ts
import { r2Storage } from "@monti-cms/storage-s3";

defineServerConfig({
	// …
	media: r2Storage(), // reads the R2_* variables below
});
```

With no arguments the store reads the environment variables. Options override them. The values are read on first use, so they may be empty while building; a missing one fails with an error that names the variable (`r2Storage: R2_BUCKET is not set ...`).

### Cloudflare R2: `r2Storage()`

| Variable | Option | Meaning |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | `accountId` | Cloudflare account ID. The endpoint is `https://<id>.r2.cloudflarestorage.com` |
| `R2_ENDPOINT` | `endpoint` | Use instead of the account ID (a jurisdiction endpoint such as EU) |
| `R2_BUCKET` | `bucket` | Bucket name |
| `R2_ACCESS_KEY_ID` | `accessKeyId` | R2 API token, access key ID |
| `R2_SECRET_ACCESS_KEY` | `secretAccessKey` | R2 API token, secret |
| `R2_PUBLIC_URL` | `publicBaseUrl` | Public start of file URLs: a custom domain or the `r2.dev` URL |

The region is always `auto`. One of `R2_ACCOUNT_ID` and `R2_ENDPOINT` is enough.

### AWS S3, MinIO and others: `s3Storage()`

| Variable | Option | Meaning |
| --- | --- | --- |
| `S3_REGION` | `region` | Bucket region, e.g. `ap-northeast-2` |
| `S3_ENDPOINT` | `endpoint` | S3 API URL. Optional on AWS (defaults to `https://s3.<region>.amazonaws.com`), required for MinIO |
| `S3_BUCKET` | `bucket` | Bucket name |
| `S3_ACCESS_KEY_ID` | `accessKeyId` | Access key ID |
| `S3_SECRET_ACCESS_KEY` | `secretAccessKey` | Secret access key |
| `S3_PUBLIC_URL` | `publicBaseUrl` | Public start of file URLs: a CDN or the public bucket URL |
| `S3_FORCE_PATH_STYLE` | `forcePathStyle` | `true` for path-style URLs (`<endpoint>/<bucket>/<key>`), needed by MinIO |

```ts
media: s3Storage(), // AWS: S3_REGION and the rest from .env.local
media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true }), // MinIO
```

The files must be publicly readable at the public URL, and the bucket needs a CORS rule that allows `PUT` from your site for the browser upload.

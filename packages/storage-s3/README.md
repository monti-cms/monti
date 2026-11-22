# @monti-cms/storage-s3

English | [한국어](README.ko.md)

Monti's media `StorageAdapter` for S3 and S3-compatible object stores: AWS S3, Cloudflare R2, and MinIO.

```ts
// monti.config.ts
import type { MontiConfig } from "@monti-cms/core";
import { s3Storage } from "@monti-cms/storage-s3";

export default {
	name: "My Site",
	storage: s3Storage(),
} satisfies MontiConfig;
```

## Configuration

Connection values are read lazily when the adapter is first used (so builds succeed without credentials). Each value can be passed directly to `s3Storage({ ... })` or provided via environment variables; direct options take precedence over environment variables.

| Option | Env var | Required | Description |
|---|---|---|---|
| `bucket` | `S3_BUCKET` | Yes | Bucket name |
| `accessKeyId` | `S3_ACCESS_KEY_ID` | Yes | Access key ID (static credentials) |
| `secretAccessKey` | `S3_SECRET_ACCESS_KEY` | Yes | Secret access key |
| `publicUrl` | `S3_PUBLIC_URL` | Yes | Public bucket or CDN base URL (`http:`/`https:`, no query/fragment/credentials). File URL is `<publicUrl>/<key>` |
| `region` | `S3_REGION` | Conditional | AWS region. Defaults to `"auto"` when `endpoint` is set (Cloudflare R2) |
| `endpoint` | `S3_ENDPOINT` | Conditional | Custom S3 API endpoint (R2, MinIO). At least one of `region` or `endpoint` is required |
| `forcePathStyle` | `S3_FORCE_PATH_STYLE` | No | Put the bucket in the URL path instead of the host (`"true"` or `"1"` in env; needed for MinIO or buckets with dots in their name) |
| `ticketSeconds` | — | No | Presigned `PUT` expiration in seconds (`1`–`3600`, default `600`, always shorter than core's 24-hour `loose_files` TTL) |
| `allowedMimeTypes` | — | No | Allowed MIME types (non-empty array, case-insensitive, no parameters). Defaults to `DEFAULT_ALLOWED_MIME_TYPES` |
| `maxSize` | — | No | Maximum upload size in bytes (`1`–`2_147_483_647`, default `10 * 1024 * 1024` / 10 MiB) |
| `env` | — | No | Environment object to read from (defaults to `process.env`) |

To extend the default MIME list:

```ts
import { DEFAULT_ALLOWED_MIME_TYPES, s3Storage } from "@monti-cms/storage-s3";

export const storage = s3Storage({
	allowedMimeTypes: [...DEFAULT_ALLOWED_MIME_TYPES, "image/heic"],
	maxSize: 50 * 1024 * 1024,
});
```

## Security and Upload Flow

- **Direct browser uploads**: `media.startUpload` calls `storage.ticket(key, { mime, size })` to issue a presigned `PUT` URL bound to the key, `Content-Type`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable`, `If-None-Match: *` (prevents overwriting an existing key), and `Content-Disposition: attachment` for non-images and SVG.
- **UUID-only keys**: All methods (`ticket`, `stat`, `url`, `remove`) only accept lowercase UUID keys matching `core`'s `media.startUpload`, protecting unrelated objects in a shared bucket.
- **Default MIME policy**: Allows safe raster images (`jpeg`, `png`, `webp`, `gif`, `avif`), documents (`pdf`, `plain`, `csv`), video (`mp4`, `webm`), audio (`mpeg`, `wav`, `ogg`), and `zip`. Excludes `image/svg+xml` and `text/html` by default.
- **Public origin isolation**: Use a dedicated bucket for Monti and serve files from a domain that does not share cookies with your site.
- **Idempotent cleanup**: `remove(key)` succeeds on `204` or exact `NoSuchKey`, while propagating `NoSuchBucket`, permission (`403`), and network errors so `core`'s `removeLooseFiles` retains the queue row for retry.
- **AWS S3 permissions**: Grant `s3:ListBucket` on the bucket in addition to `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` so `HeadObject` on a missing key returns `404` (`null`) instead of `403`.

## Bucket CORS

Configure the bucket to allow `PUT` from your admin origin(s) (on MinIO Community, configure CORS via the server-level `MINIO_API_CORS_ALLOW_ORIGIN` environment variable instead of per-bucket rules):

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

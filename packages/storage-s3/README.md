# @monti-cms/storage-s3

English | [한국어](README.ko.md)

Monti's media files in S3, or in a storage that speaks its API: AWS S3, Cloudflare R2, MinIO.

```ts
// monti.config.ts
import { defineConfig, definePlugin } from "@monti-cms/core";
import { s3Storage } from "@monti-cms/storage-s3";

export default defineConfig({
	// …
	plugins: [definePlugin({ name: "files", storage: s3Storage() })],
});
```

`npx monti init --storage s3` writes this, and the names below into `.env.local`.

## Values

Read from the environment when the storage is first used (a site builds without them); each can be given to `s3Storage({ … })` instead. A
missing one is an error that names it.

| Name | What it is |
|---|---|
| `S3_BUCKET` | The bucket |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The key the site reads and writes the bucket with |
| `S3_PUBLIC_URL` | The start of the address files are read from: the public bucket, or the CDN in front of it. A file's address is `<this>/<key>` |
| `S3_REGION` | The region, for AWS. Left out with an endpoint, it is `auto` (R2's) |
| `S3_ENDPOINT` | The storage's own address, for one that is not AWS. R2: `https://<account>.r2.cloudflarestorage.com` |
| `S3_FORCE_PATH_STYLE` | `true` to put the bucket in the path and not the host name (MinIO) |

- Files are read by anyone who has the address. The bucket is public, or a CDN in front of it is. No file gets an ACL (R2 takes none): who
  may read is the bucket's setting. A private bucket whose every read is signed is not supported.
- A key is written once and never changed, so files go up with `Cache-Control: public, max-age=31536000, immutable`.

## Files go straight to the bucket

A host may take smaller requests than the largest file Monti takes (10 MB; serverless functions often stop at 4.5 MB). So a file's bytes
never pass through the site:

1. The admin asks the site for a ticket, with the file's name, size and first bytes. The site checks them by the rule of the media library,
   makes the key, and answers with an address signed for one `PUT` of that key, of that type and that size.
2. The browser sends the file to that address.
3. The admin tells the site. The site looks at what the bucket holds: its size, and its first bytes, by the same rule. A file that is not
   what the ticket was for is deleted and refused. Until this passes no item names the file.

A file that is sent and never becomes an item is removed by the clean-up, as on the other way up.

## The bucket's CORS

The bucket must take a `PUT` from each address the admin is opened at, `http://localhost:3000` in development too. `npx monti doctor
--origin https://your.site` asks the bucket as a browser does and, when it says no, prints the setting to paste:

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

## What was tried

The tests run against a stand-in bucket in this package (`src/__test__/fake-s3.ts`), which checks a signed address the way S3 documents
it. No real bucket has been used yet: AWS S3, R2 and MinIO are untried, and so is a browser's upload across origins.

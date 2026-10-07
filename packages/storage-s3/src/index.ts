/**
 * Media storage on the S3 API (`@monti-cms/storage-s3`): AWS S3, Cloudflare R2 and MinIO. Goes into `media` of the server config.
 *
 * ```ts
 * media: r2Storage()   // reads R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL
 * media: s3Storage()   // reads S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL
 * ```
 */
export type { MediaStoreConfig } from "./media-store";
export { type R2Options, r2Storage, type S3StorageOptions, s3Storage } from "./s3";

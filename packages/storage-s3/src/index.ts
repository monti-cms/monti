/**
 * Media storage on the S3 API (`@monti-cms/storage-s3`): AWS S3, Cloudflare R2, MinIO and any other store that speaks it. One function, one env prefix.
 * Goes into `storage` of `defineConfig` (`monti.config.ts`).
 *
 * ```ts
 * storage: s3Storage()   // reads S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL, S3_FORCE_PATH_STYLE
 * ```
 */
export type { MediaStoreConfig } from "./media-store";
export { type S3StorageOptions, s3Storage } from "./s3";

import type { MediaStoreConfig } from "../adapters/r2/types.js";
import type { MediaAdapter } from "../server/define.js";
/** Connection whose values may be empty (environment variables may be absent during a build). A missing value is an error on first use. */
export type S3StorageOptions = {
    readonly [K in keyof MediaStoreConfig]: MediaStoreConfig[K] | undefined;
};
/** S3 API store (AWS S3, MinIO, etc.). `region` is the bucket region; for MinIO use `forcePathStyle: true`. */
export declare function s3Storage(options: S3StorageOptions, name?: string): MediaAdapter;
/** Cloudflare R2. The region is `auto`. */
export type R2Options = Omit<S3StorageOptions, "region" | "forcePathStyle">;
export declare const r2Storage: (options: R2Options) => MediaAdapter;
export type { MediaStoreConfig } from "../adapters/r2/types.js";

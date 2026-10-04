/**
 * S3 API media store (`@monti-cms/core/s3`). Goes into `media` of the server config. The AWS SDK (`@aws-sdk/client-s3` and
 * `@aws-sdk/s3-request-presigner`) is installed only by sites that use this entry point (optional dependencies).
 *
 * ```ts
 * media: r2Storage({ endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl })
 * media: s3Storage({ endpoint: "https://s3.ap-northeast-2.amazonaws.com", region: "ap-northeast-2", … })
 * media: s3Storage({ endpoint: "http://localhost:9000", forcePathStyle: true, … })   // MinIO
 * ```
 */
import { createS3MediaStore } from "../adapters/r2/media-store";
import type { MediaStoreConfig } from "../adapters/r2/types";
import type { MediaAdapter } from "../server/define";

/** Connection whose values may be empty (environment variables may be absent during a build). A missing value is an error on first use. */
export type S3StorageOptions = { readonly [K in keyof MediaStoreConfig]: MediaStoreConfig[K] | undefined };

const REQUIRED = ["accessKeyId", "secretAccessKey", "bucket", "endpoint", "publicBaseUrl"] as const;

/** S3 API store (AWS S3, MinIO, etc.). `region` is the bucket region; for MinIO use `forcePathStyle: true`. */
export function s3Storage(options: S3StorageOptions, name = "s3"): MediaAdapter {
	return {
		name,
		createStore: () => {
			const missing = REQUIRED.filter((key) => !options[key]);
			if (missing.length > 0) throw new Error(`cms.server: ${name}Storage is missing ${missing.join(", ")}`);
			return createS3MediaStore(options as MediaStoreConfig);
		},
	};
}

/** Cloudflare R2. The region is `auto`. */
export type R2Options = Omit<S3StorageOptions, "region" | "forcePathStyle">;

export const r2Storage = (options: R2Options): MediaAdapter => s3Storage({ ...options, region: "auto" }, "r2");

export type { MediaStoreConfig } from "../adapters/r2/types";

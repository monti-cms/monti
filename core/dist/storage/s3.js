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
import { createS3MediaStore } from "../adapters/r2/media-store.js";
const REQUIRED = ["accessKeyId", "secretAccessKey", "bucket", "endpoint", "publicBaseUrl"];
/** S3 API store (AWS S3, MinIO, etc.). `region` is the bucket region; for MinIO use `forcePathStyle: true`. */
export function s3Storage(options, name = "s3") {
    return {
        name,
        createStore: () => {
            const missing = REQUIRED.filter((key) => !options[key]);
            if (missing.length > 0)
                throw new Error(`cms.server: ${name}Storage is missing ${missing.join(", ")}`);
            return createS3MediaStore(options);
        },
    };
}
export const r2Storage = (options) => s3Storage({ ...options, region: "auto" }, "r2");

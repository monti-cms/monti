import { type MediaStore } from "@monti-cms/core/server";
/** S3 API store connection (R2, S3, MinIO, etc.). */
export interface MediaStoreConfig {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    /** S3 API URL (R2: `https://<account>.r2.cloudflarestorage.com`, AWS S3: `https://s3.<region>.amazonaws.com`). */
    endpoint: string;
    /** Start of the public URL (CDN or public bucket URL). The public URL of an uploaded file is `<publicBaseUrl>/<key>`. */
    publicBaseUrl: string;
    /** Region. R2 uses `auto` (default), AWS S3 the bucket region (e.g. `ap-northeast-2`). */
    region?: string;
    /** Path-style URL (`<endpoint>/<bucket>/<key>`). Turn on for stores like MinIO. */
    forcePathStyle?: boolean;
}
/** S3 API media store (R2, S3, MinIO, etc.). Uploads via presigned URLs, then the server verifies and moves the file. */
export declare function createS3MediaStore(config: MediaStoreConfig): MediaStore;

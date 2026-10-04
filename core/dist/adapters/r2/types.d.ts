import { type AllowedFileMime, type AllowedImageMimeType as AllowedImageMime } from "../../core/media-types.js";
export type { AllowedImageMime };
/** Formats the store accepts: images and attachments. */
export type AllowedMediaMime = AllowedImageMime | AllowedFileMime;
/**
 * The store accepts every format the core can detect. The formats and sizes narrowed by the site config (`media`) are checked by the upload API.
 * The store is created by the server config (`cms.server.ts`), so it does not read the site config.
 */
export declare const ALLOWED_MEDIA_MIMES: readonly AllowedMediaMime[];
export interface StoredFileHead {
    key: string;
    contentType: string;
    contentLength: number;
    etag?: string;
    lastModified?: Date;
}
export interface PrepareUploadInput {
    stagingKey: string;
    contentType: AllowedMediaMime;
    expiresInSeconds: number;
    checksumSha256?: string;
}
export interface PrepareUploadOutput {
    url: string;
    method: "PUT";
    requiredHeaders: Record<string, string>;
    expiresAt: Date;
}
export interface PromoteFileInput {
    stagingKey: string;
    finalKey: string;
    expectedEtag?: string;
    contentType: AllowedMediaMime;
    cacheControl?: string;
    /** Makes attachments download under their original name (`attachment; filename*=...`). */
    contentDisposition?: string;
}
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
export interface MediaStore {
    prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadOutput>;
    headFile(input: {
        key: string;
        signal?: AbortSignal;
    }): Promise<StoredFileHead | null>;
    readFile(input: {
        key: string;
        maxBytes: number;
        signal?: AbortSignal;
    }): Promise<Uint8Array>;
    /** Reads only the first `bytes` bytes of the file (attachment format check). Implementations without it fall back to `readFile`. */
    readPrefix?(input: {
        key: string;
        bytes: number;
        signal?: AbortSignal;
    }): Promise<Uint8Array>;
    promoteFile(input: PromoteFileInput): Promise<StoredFileHead>;
    deleteFile(input: {
        key: string;
        signal?: AbortSignal;
    }): Promise<void>;
    getPublicUrl(finalKey: string): string;
}

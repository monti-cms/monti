import {
	type AllowedFileMime,
	type AllowedImageMimeType as AllowedImageMime,
	SUPPORTED_FILE_MIME_TYPES,
	SUPPORTED_IMAGE_MIME_TYPES,
} from "../core/media-types";

export type { AllowedImageMime };
/** Formats the store accepts: images and attachments. */
export type AllowedMediaMime = AllowedImageMime | AllowedFileMime;

/**
 * The store accepts every format the core can detect. The formats and sizes narrowed by the site config (`media`) are checked by the upload API.
 * The store is created by the server config (`cms.server.ts`), so it does not read the site config.
 */
export const ALLOWED_MEDIA_MIMES: readonly AllowedMediaMime[] = [
	...SUPPORTED_IMAGE_MIME_TYPES,
	...SUPPORTED_FILE_MIME_TYPES,
];

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

export interface MediaStore {
	prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadOutput>;
	headFile(input: { key: string; signal?: AbortSignal }): Promise<StoredFileHead | null>;
	readFile(input: { key: string; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	/** Reads only the first `bytes` bytes of the file (attachment format check). Implementations without it fall back to `readFile`. */
	readPrefix?(input: { key: string; bytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	promoteFile(input: PromoteFileInput): Promise<StoredFileHead>;
	deleteFile(input: { key: string; signal?: AbortSignal }): Promise<void>;
	getPublicUrl(finalKey: string): string;
}

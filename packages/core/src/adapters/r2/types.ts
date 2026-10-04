import {
	type AllowedFileMime,
	type AllowedImageMimeType as AllowedImageMime,
	SUPPORTED_FILE_MIME_TYPES,
	SUPPORTED_IMAGE_MIME_TYPES,
} from "../../core/media-types";

export type { AllowedImageMime };
/** 저장소가 받는 형식: 이미지와 첨부 파일(v3). */
export type AllowedMediaMime = AllowedImageMime | AllowedFileMime;

/**
 * 저장소가 받는 형식은 본체가 판별할 수 있는 형식 전부다. 사이트 설정(`media`)으로 좁힌 형식·크기는 업로드 API가 본다.
 * 저장소는 서버 설정(`cms.server.ts`)이 만들므로 사이트 설정을 읽지 않는다(M17-3).
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
	/** 첨부 파일은 원래 이름으로 내려받게 한다(`attachment; filename*=…`). */
	contentDisposition?: string;
}

/** S3 API 저장소 연결(R2·S3·MinIO 등). */
export interface MediaStoreConfig {
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	/** S3 API 주소(R2: `https://<계정>.r2.cloudflarestorage.com`, AWS S3: `https://s3.<지역>.amazonaws.com`). */
	endpoint: string;
	/** 공개 주소의 앞부분(CDN·공개 버킷 주소). 올린 파일의 공개 주소는 `<publicBaseUrl>/<키>`다. */
	publicBaseUrl: string;
	/** 지역. R2는 `auto`(기본), AWS S3는 버킷 지역(예: `ap-northeast-2`). */
	region?: string;
	/** 경로 방식 주소(`<endpoint>/<버킷>/<키>`). MinIO 같은 저장소에서 켠다. */
	forcePathStyle?: boolean;
}

export interface MediaStore {
	prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadOutput>;
	headFile(input: { key: string; signal?: AbortSignal }): Promise<StoredFileHead | null>;
	readFile(input: { key: string; maxBytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	/** 파일 앞 `bytes`바이트만 읽는다(첨부 파일 형식 확인). 없는 구현은 `readFile`로 대신한다. */
	readPrefix?(input: { key: string; bytes: number; signal?: AbortSignal }): Promise<Uint8Array>;
	promoteFile(input: PromoteFileInput): Promise<StoredFileHead>;
	deleteFile(input: { key: string; signal?: AbortSignal }): Promise<void>;
	getPublicUrl(finalKey: string): string;
}

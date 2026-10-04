/**
 * 본체가 판별할 수 있는 미디어 형식(M17-4). 사이트 설정 `media.imageTypes`·`fileTypes`는 이 안에서 고른다.
 * 설정 검사(`config/define`)도 읽으므로 다른 모듈을 import하지 않는다.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

/** 이미지가 아닌 첨부 파일. 실행 파일과 HTML·SVG처럼 브라우저가 열면 스크립트가 도는 형식은 받지 않는다. */
export const SUPPORTED_FILE_MIME_TYPES = [
	"application/pdf",
	"application/zip",
	"text/plain",
	"text/markdown",
	"text/csv",
	"application/json",
] as const;

export type AllowedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export type AllowedFileMime = (typeof SUPPORTED_FILE_MIME_TYPES)[number];

/** 기본 한도: 이미지 10MB·4천만 픽셀, 첨부 파일 50MB. */
export const DEFAULT_MEDIA_LIMITS = {
	maxImageBytes: 10 * 1024 * 1024,
	maxPixels: 40_000_000,
	maxFileBytes: 50 * 1024 * 1024,
} as const;

/** 사이트 설정 `media`(올릴 수 있는 형식·크기 한도). */
export interface MediaConfig {
	/** 이미지 최대 크기(바이트). 기본 10MB. */
	readonly maxImageBytes?: number;
	/** 이미지 최대 픽셀 수(가로×세로). 기본 4천만. */
	readonly maxPixels?: number;
	/** 첨부 파일 최대 크기(바이트). 기본 50MB. */
	readonly maxFileBytes?: number;
	/** 받을 이미지 형식(지원 형식 가운데서). 기본 전부. */
	readonly imageTypes?: readonly AllowedImageMimeType[];
	/** 받을 첨부 파일 형식(지원 형식 가운데서). 기본 전부. 빈 목록이면 첨부 파일을 받지 않는다. */
	readonly fileTypes?: readonly AllowedFileMime[];
}

/** 설정 검사. 잘못된 값이면 오류를 던진다(개발자용 영어 문구). */
export function validateMediaConfig(media: MediaConfig | undefined): void {
	if (!media) return;
	for (const key of ["maxImageBytes", "maxPixels", "maxFileBytes"] as const) {
		const value = media[key];
		if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
			throw new Error(`cms.config: media.${key} must be a positive integer`);
		}
	}
	const check = (key: "imageTypes" | "fileTypes", supported: readonly string[]) => {
		for (const type of media[key] ?? []) {
			if (!supported.includes(type)) {
				throw new Error(`cms.config: media.${key} has unsupported type "${type}" (supported: ${supported.join(", ")})`);
			}
		}
	};
	check("imageTypes", SUPPORTED_IMAGE_MIME_TYPES);
	check("fileTypes", SUPPORTED_FILE_MIME_TYPES);
	if (media.imageTypes?.length === 0) throw new Error("cms.config: media.imageTypes must not be empty");
}

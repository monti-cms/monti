import { checkKnownKeys, type Issue, IssueList, pathOf } from "../config/check/issue";
/**
 * Media formats the core can identify. The site config `media.imageTypes` and `fileTypes` choose from these.
 * The config validation (`config/define`) also reads this, so it does not import other modules.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

/** Non-image attachments. Executables and formats that run scripts when a browser opens them, such as HTML and SVG, are not accepted. */
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

/** Defaults: images 10MB and 40 million pixels, attached files 50MB. */
export const DEFAULT_MEDIA_LIMITS = {
	maxImageBytes: 10 * 1024 * 1024,
	maxPixels: 40_000_000,
	maxFileBytes: 50 * 1024 * 1024,
} as const;

/** Site config `media` (uploadable formats and size limits). */
export interface MediaConfig {
	/** Maximum image size in bytes. Default 10MB. */
	readonly maxImageBytes?: number;
	/** Maximum image pixel count (width × height). Default 40 million. */
	readonly maxPixels?: number;
	/** Maximum attached file size in bytes. Default 50MB. */
	readonly maxFileBytes?: number;
	/** Accepted image formats (among the supported ones). Default all. */
	readonly imageTypes?: readonly AllowedImageMimeType[];
	/** Accepted attached file formats (among the supported ones). Default all. An empty list accepts no attached files. */
	readonly fileTypes?: readonly AllowedFileMime[];
}

const MEDIA_KEYS = ["maxImageBytes", "maxPixels", "maxFileBytes", "imageTypes", "fileTypes"];

/** Checks the media settings of the site config. */
export function checkMediaConfig(media: MediaConfig | undefined): Issue[] {
	if (!media) return [];
	const list = new IssueList();
	checkKnownKeys(list, "media", media, MEDIA_KEYS);
	for (const key of ["maxImageBytes", "maxPixels", "maxFileBytes"] as const) {
		const value = media[key];
		if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
			list.add(pathOf("media", key), "positive-integer", "must be a positive integer");
		}
	}
	const check = (key: "imageTypes" | "fileTypes", supported: readonly string[]) => {
		for (const [index, type] of (media[key] ?? []).entries()) {
			if (!supported.includes(type)) {
				list.add(
					pathOf("media", key, index),
					"unsupported",
					`"${type}" is not supported (supported: ${supported.join(", ")})`,
				);
			}
		}
	};
	check("imageTypes", SUPPORTED_IMAGE_MIME_TYPES);
	check("fileTypes", SUPPORTED_FILE_MIME_TYPES);
	if (media.imageTypes?.length === 0) list.add("media.imageTypes", "empty", "must not be empty");
	return list.issues;
}

import { checkKnownKeys, type Issue, IssueList, pathOf } from "../config/check/issue";
/** Only the start of a text file is read to check it. */
export const TEXT_SNIFF_BYTES = 64 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
	signature.every((byte, index) => bytes[index] === byte);

/** Readable as UTF-8 with no NUL bytes (this stops binaries from being uploaded as text files). */
function looksLikeText(bytes: Uint8Array): boolean {
	if (bytes.includes(0)) return false;
	try {
		// Only the start was read, so the last character may be cut off. Exclude the final 3 bytes from the check.
		const end = bytes.length >= TEXT_SNIFF_BYTES ? Math.max(0, bytes.length - 3) : bytes.length;
		new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
		return true;
	} catch {
		return false;
	}
}

const CODE_EXTENSIONS = [
	"js",
	"mjs",
	"cjs",
	"jsx",
	"ts",
	"tsx",
	"py",
	"java",
	"kt",
	"c",
	"h",
	"cpp",
	"hpp",
	"cs",
	"go",
	"rs",
	"rb",
	"php",
	"swift",
	"dart",
	"scala",
	"css",
	"scss",
	"sass",
	"less",
	"vue",
	"svelte",
	"sql",
	"yml",
	"yaml",
	"toml",
	"ini",
	"env",
	"log",
	"diff",
	"patch",
	"gradle",
	"dockerfile",
] as const;

/**
 * Every media format the core can identify, keyed by MIME type. This is the only place a format is listed: the supported
 * lists, the file key extension, the file name → type lookup and the content check all derive from it. The site config
 * `media.imageTypes` and `fileTypes` choose from these. Config validation (`config/define`) also reads this, so it does not
 * import other modules.
 *
 * - `extensions`: the first is the one used in the file key; all are accepted in a file name for an attachment.
 * - `sniff`: checks an attachment's actual bytes (`sniffBytes` of the start are read). Images have none here: their format,
 *   width and height are read together by `detectImageDimensionsAndType`.
 *
 * Executables and formats that run scripts when a browser opens them, such as HTML and SVG, are not accepted.
 */
export const MEDIA_TYPES = {
	"image/jpeg": { kind: "image", extensions: ["jpg", "jpeg"] },
	"image/png": { kind: "image", extensions: ["png"] },
	"image/webp": { kind: "image", extensions: ["webp"] },
	"image/gif": { kind: "image", extensions: ["gif"] },
	"image/avif": { kind: "image", extensions: ["avif"] },
	"application/pdf": {
		kind: "file",
		extensions: ["pdf"],
		sniffBytes: 8,
		sniff: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
	},
	"application/zip": {
		kind: "file",
		extensions: ["zip"],
		sniffBytes: 8,
		// Regular zip and empty zip.
		sniff: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]),
	},
	// Source code is stored as a text file (browsers report code file MIME types inconsistently).
	"text/plain": {
		kind: "file",
		extensions: ["txt", ...CODE_EXTENSIONS],
		sniffBytes: TEXT_SNIFF_BYTES,
		sniff: looksLikeText,
	},
	"text/markdown": { kind: "file", extensions: ["md", "markdown"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
	"text/csv": { kind: "file", extensions: ["csv"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
	"application/json": { kind: "file", extensions: ["json"], sniffBytes: TEXT_SNIFF_BYTES, sniff: looksLikeText },
} as const satisfies Record<
	string,
	| { kind: "image"; extensions: readonly string[] }
	| {
			kind: "file";
			extensions: readonly string[];
			sniffBytes: number;
			sniff: (bytes: Uint8Array) => boolean;
	  }
>;

type MediaTypes = typeof MEDIA_TYPES;
export type AllowedImageMimeType = {
	[M in keyof MediaTypes]: MediaTypes[M]["kind"] extends "image" ? M : never;
}[keyof MediaTypes];
export type AllowedFileMime = {
	[M in keyof MediaTypes]: MediaTypes[M]["kind"] extends "file" ? M : never;
}[keyof MediaTypes];
export type AllowedMediaMime = AllowedImageMimeType | AllowedFileMime;

const mimesOfKind = <K extends "image" | "file">(kind: K) =>
	(Object.keys(MEDIA_TYPES) as AllowedMediaMime[]).filter((mime) => MEDIA_TYPES[mime].kind === kind);

export const SUPPORTED_IMAGE_MIME_TYPES = mimesOfKind("image") as readonly AllowedImageMimeType[] as [
	AllowedImageMimeType,
	...AllowedImageMimeType[],
];
export const SUPPORTED_FILE_MIME_TYPES = mimesOfKind("file") as readonly AllowedFileMime[] as [
	AllowedFileMime,
	...AllowedFileMime[],
];

/** Fixed fact: is this MIME type one of the image formats the core knows? Independent of any site's config. */
export const isImageType = (mimeType: string | null | undefined): mimeType is AllowedImageMimeType =>
	typeof mimeType === "string" &&
	Object.hasOwn(MEDIA_TYPES, mimeType) &&
	MEDIA_TYPES[mimeType as AllowedMediaMime].kind === "image";

/** The extension used in the file key for a type, not taken from the user-supplied filename. */
export const extensionFor = (mimeType: AllowedMediaMime): string => MEDIA_TYPES[mimeType].extensions[0];

/** The attachment type a file name's extension stands for (any site), or `null`. */
export function fileTypeByExtension(filename: string): AllowedFileMime | null {
	if (!filename.includes(".")) return null;
	const extension = filename.toLowerCase().split(".").pop() ?? "";
	return (
		SUPPORTED_FILE_MIME_TYPES.find((mime) => (MEDIA_TYPES[mime].extensions as readonly string[]).includes(extension)) ??
		null
	);
}

/** Checks that an attachment's actual bytes match its type. */
export function sniffFile(bytes: Uint8Array, mimeType: AllowedFileMime): boolean {
	return MEDIA_TYPES[mimeType].sniff(bytes);
}

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

import { type ConfigIssue } from "../config/check/issue.js";
/** Only the start of a text file is read to check it. */
export declare const TEXT_SNIFF_BYTES: number;
/** Readable as UTF-8 with no NUL bytes (this stops binaries from being uploaded as text files). */
declare function looksLikeText(bytes: Uint8Array): boolean;
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
export declare const MEDIA_TYPES: {
    readonly "image/jpeg": {
        readonly kind: "image";
        readonly extensions: readonly ["jpg", "jpeg"];
    };
    readonly "image/png": {
        readonly kind: "image";
        readonly extensions: readonly ["png"];
    };
    readonly "image/webp": {
        readonly kind: "image";
        readonly extensions: readonly ["webp"];
    };
    readonly "image/gif": {
        readonly kind: "image";
        readonly extensions: readonly ["gif"];
    };
    readonly "image/avif": {
        readonly kind: "image";
        readonly extensions: readonly ["avif"];
    };
    readonly "application/pdf": {
        readonly kind: "file";
        readonly extensions: readonly ["pdf"];
        readonly sniffBytes: 8;
        readonly sniff: (bytes: Uint8Array<ArrayBufferLike>) => boolean;
    };
    readonly "application/zip": {
        readonly kind: "file";
        readonly extensions: readonly ["zip"];
        readonly sniffBytes: 8;
        readonly sniff: (bytes: Uint8Array<ArrayBufferLike>) => boolean;
    };
    readonly "text/plain": {
        readonly kind: "file";
        readonly extensions: readonly ["txt", "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "java", "kt", "c", "h", "cpp", "hpp", "cs", "go", "rs", "rb", "php", "swift", "dart", "scala", "css", "scss", "sass", "less", "vue", "svelte", "sql", "yml", "yaml", "toml", "ini", "env", "log", "diff", "patch", "gradle", "dockerfile"];
        readonly sniffBytes: number;
        readonly sniff: typeof looksLikeText;
    };
    readonly "text/markdown": {
        readonly kind: "file";
        readonly extensions: readonly ["md", "markdown"];
        readonly sniffBytes: number;
        readonly sniff: typeof looksLikeText;
    };
    readonly "text/csv": {
        readonly kind: "file";
        readonly extensions: readonly ["csv"];
        readonly sniffBytes: number;
        readonly sniff: typeof looksLikeText;
    };
    readonly "application/json": {
        readonly kind: "file";
        readonly extensions: readonly ["json"];
        readonly sniffBytes: number;
        readonly sniff: typeof looksLikeText;
    };
};
type MediaTypes = typeof MEDIA_TYPES;
export type AllowedImageMimeType = {
    [M in keyof MediaTypes]: MediaTypes[M]["kind"] extends "image" ? M : never;
}[keyof MediaTypes];
export type AllowedFileMime = {
    [M in keyof MediaTypes]: MediaTypes[M]["kind"] extends "file" ? M : never;
}[keyof MediaTypes];
export type AllowedMediaMime = AllowedImageMimeType | AllowedFileMime;
export declare const SUPPORTED_IMAGE_MIME_TYPES: [AllowedImageMimeType, ...AllowedImageMimeType[]];
export declare const SUPPORTED_FILE_MIME_TYPES: [AllowedFileMime, ...AllowedFileMime[]];
/** Fixed fact: is this MIME type one of the image formats the core knows? Independent of any site's config. */
export declare const isImageType: (mimeType: string | null | undefined) => mimeType is AllowedImageMimeType;
/** The extension used in the file key for a type, not taken from the user-supplied filename. */
export declare const extensionFor: (mimeType: AllowedMediaMime) => string;
/** The attachment type a file name's extension stands for (any site), or `null`. */
export declare function fileTypeByExtension(filename: string): AllowedFileMime | null;
/** Checks that an attachment's actual bytes match its type. */
export declare function sniffFile(bytes: Uint8Array, mimeType: AllowedFileMime): boolean;
/** Defaults: images 10MB and 40 million pixels, attached files 50MB. */
export declare const DEFAULT_MEDIA_LIMITS: {
    readonly maxImageBytes: number;
    readonly maxPixels: 40000000;
    readonly maxFileBytes: number;
};
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
/** Checks the media settings of the site config. */
export declare function checkMediaConfig(media: MediaConfig | undefined): ConfigIssue[];
export {};

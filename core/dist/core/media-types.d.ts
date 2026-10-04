/**
 * Media formats the core can identify. The site config `media.imageTypes` and `fileTypes` choose from these.
 * The config validation (`config/define`) also reads this, so it does not import other modules.
 */
export declare const SUPPORTED_IMAGE_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
/** Non-image attachments. Executables and formats that run scripts when a browser opens them, such as HTML and SVG, are not accepted. */
export declare const SUPPORTED_FILE_MIME_TYPES: readonly ["application/pdf", "application/zip", "text/plain", "text/markdown", "text/csv", "application/json"];
export type AllowedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export type AllowedFileMime = (typeof SUPPORTED_FILE_MIME_TYPES)[number];
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
/** Config validation. Throws an error for invalid values (English message for developers). */
export declare function validateMediaConfig(media: MediaConfig | undefined): void;

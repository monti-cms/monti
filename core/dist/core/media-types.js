/**
 * Media formats the core can identify. The site config `media.imageTypes` and `fileTypes` choose from these.
 * The config validation (`config/define`) also reads this, so it does not import other modules.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
/** Non-image attachments. Executables and formats that run scripts when a browser opens them, such as HTML and SVG, are not accepted. */
export const SUPPORTED_FILE_MIME_TYPES = [
    "application/pdf",
    "application/zip",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
];
/** Defaults: images 10MB and 40 million pixels, attached files 50MB. */
export const DEFAULT_MEDIA_LIMITS = {
    maxImageBytes: 10 * 1024 * 1024,
    maxPixels: 40_000_000,
    maxFileBytes: 50 * 1024 * 1024,
};
/** Config validation. Throws an error for invalid values (English message for developers). */
export function validateMediaConfig(media) {
    if (!media)
        return;
    for (const key of ["maxImageBytes", "maxPixels", "maxFileBytes"]) {
        const value = media[key];
        if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
            throw new Error(`cms.config: media.${key} must be a positive integer`);
        }
    }
    const check = (key, supported) => {
        for (const type of media[key] ?? []) {
            if (!supported.includes(type)) {
                throw new Error(`cms.config: media.${key} has unsupported type "${type}" (supported: ${supported.join(", ")})`);
            }
        }
    };
    check("imageTypes", SUPPORTED_IMAGE_MIME_TYPES);
    check("fileTypes", SUPPORTED_FILE_MIME_TYPES);
    if (media.imageTypes?.length === 0)
        throw new Error("cms.config: media.imageTypes must not be empty");
}

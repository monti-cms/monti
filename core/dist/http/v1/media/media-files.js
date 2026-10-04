import { ALLOWED_FILE_MIME_TYPES, ALLOWED_IMAGE_MIME_TYPES, isImageMime, MAX_FILE_BYTES, MAX_MEDIA_BYTES, MAX_MEDIA_PIXELS, } from "../../../core/api.js";
import { detectImageDimensionsAndType } from "../../../media/image-detect.js";
import { HttpError } from "../error-handler.js";
export const UPLOAD_URL_TTL_SECONDS = 600;
const EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/json": "json",
};
/** The file key's extension comes from the type, not from the user-supplied filename. */
export const extensionFor = (mimeType) => EXTENSIONS[mimeType];
/** Text files are checked by reading only the beginning. */
const TEXT_SNIFF_BYTES = 64 * 1024;
const startsWith = (bytes, signature) => signature.every((byte, index) => bytes[index] === byte);
/**
 * Checks that an attachment's actual bytes match the declared type. PDF and zip use file signatures; text files are checked
 * by being readable as UTF-8 with no NUL bytes (this stops binaries from being uploaded as text files).
 */
function detectFileType(bytes, declared) {
    switch (declared) {
        case "application/pdf":
            return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
        case "application/zip":
            // Regular zip and empty zip.
            return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
        default: {
            if (bytes.includes(0))
                return false;
            try {
                // Only the start was read, so the last character may be cut off. Exclude the final 3 bytes from the check.
                const end = bytes.length >= TEXT_SNIFF_BYTES ? Math.max(0, bytes.length - 3) : bytes.length;
                new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
                return true;
            }
            catch {
                return false;
            }
        }
    }
}
/**
 * Inspects an uploaded staging file by its actual bytes: size, type (the client MIME is not trusted), and pixel count.
 * For attachments, checks that the `declared` type matches the actual content. Throws `HttpError` on failure.
 */
export async function inspectUploadedFile(mediaStore, stagingKey, declared) {
    const head = await mediaStore.headFile({ key: stagingKey });
    if (!head)
        throw new HttpError(409, "upload_incomplete", "File has not been uploaded to storage yet");
    if (declared && !isImageMime(declared)) {
        if (!ALLOWED_FILE_MIME_TYPES.includes(declared)) {
            throw new HttpError(415, "unsupported_media_type", `File type ${declared} is not allowed`);
        }
        if (head.contentLength > MAX_FILE_BYTES) {
            throw new HttpError(413, "payload_too_large", `Uploaded file exceeds ${MAX_FILE_BYTES} bytes`);
        }
        const mimeType = declared;
        const sniff = mimeType === "application/pdf" || mimeType === "application/zip" ? 8 : TEXT_SNIFF_BYTES;
        // Empty files are not read (only an empty text file passes).
        const bytes = head.contentLength > 0
            ? mediaStore.readPrefix
                ? await mediaStore.readPrefix({ key: stagingKey, bytes: Math.min(sniff, head.contentLength) })
                : (await mediaStore.readFile({ key: stagingKey, maxBytes: head.contentLength })).subarray(0, sniff)
            : new Uint8Array();
        if (!detectFileType(bytes, mimeType)) {
            throw new HttpError(415, "unsupported_media_type", `Uploaded file is not a valid ${mimeType} file`);
        }
        return { head, detected: { mimeType, width: null, height: null } };
    }
    if (head.contentLength > MAX_MEDIA_BYTES) {
        throw new HttpError(413, "payload_too_large", `Uploaded image exceeds ${MAX_MEDIA_BYTES} bytes`);
    }
    const bytes = await mediaStore.readFile({ key: stagingKey, maxBytes: MAX_MEDIA_BYTES + 1 });
    const detected = detectImageDimensionsAndType(bytes);
    if (!detected || !ALLOWED_IMAGE_MIME_TYPES.includes(detected.mimeType)) {
        throw new HttpError(415, "unsupported_media_type", "Uploaded file is not a valid or allowed image format");
    }
    if (detected.width * detected.height > MAX_MEDIA_PIXELS) {
        throw new HttpError(413, "too_many_pixels", `Image exceeds ${MAX_MEDIA_PIXELS} pixels`);
    }
    return { head, detected };
}
/** Header value that makes an attachment download under its original name (RFC 6266, 5987). */
export function attachmentDisposition(filename) {
    const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

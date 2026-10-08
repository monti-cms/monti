import type { AllowedMediaMime, MediaStore } from "../../../media/store.js";
import type { Site } from "../../../site/index.js";
export declare const UPLOAD_URL_TTL_SECONDS = 600;
/** The file key's extension comes from the type, not from the user-supplied filename. */
export declare const extensionFor: (mimeType: AllowedMediaMime) => string;
export interface InspectedFile {
    head: NonNullable<Awaited<ReturnType<MediaStore["headFile"]>>>;
    detected: {
        mimeType: AllowedMediaMime;
        width: number | null;
        height: number | null;
    };
}
/**
 * Inspects an uploaded staging file by its actual bytes: size, type (the client MIME is not trusted), and pixel count.
 * For attachments, checks that the `declared` type matches the actual content. Throws `HttpError` on failure.
 */
export declare function inspectUploadedFile(site: Site, mediaStore: MediaStore, stagingKey: string, declared?: string | null): Promise<InspectedFile>;
/** Header value that makes an attachment download under its original name (RFC 6266, 5987). */
export declare function attachmentDisposition(filename: string): string;

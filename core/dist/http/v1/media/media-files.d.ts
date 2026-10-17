import { extensionFor } from "../../../core/media-types.js";
import type { AllowedMediaMime, MediaStore } from "../../../media/store.js";
import type { Site } from "../../../site/index.js";
import { type NoticeRef } from "../error-handler.js";
export declare const UPLOAD_URL_TTL_SECONDS = 600;
export { extensionFor };
/** File types as a person knows them (`JPG, PNG, PDF`: the first extension of each type, in capitals), for a notice that lists what is allowed. */
export declare function typeNames(mimeTypes: readonly string[]): string;
/** A size limit as a person reads it (`10 MB`, `2.5 MB`). */
export declare const megabytes: (bytes: number) => string;
/** The notice of a file that is over the size limit. */
export declare const sizeNotice: (limit: number) => NoticeRef;
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
 * For attachments, checks that the `declared` type matches the actual content. When `expectedBytes` is given, the stored size must equal it. Throws `CmsError` on failure.
 */
export declare function inspectUploadedFile(site: Site, mediaStore: MediaStore, stagingKey: string, declared?: string | null, expectedBytes?: number): Promise<InspectedFile>;
/** Header value that makes an attachment download under its original name (RFC 6266, 5987). */
export declare function attachmentDisposition(filename: string): string;
/** The extension of a file name (lowercase, with the dot), or an empty string. */
export declare const extensionOf: (filename: string) => string;
/**
 * Why a new file name is not acceptable (the notice for the person), or `null`. The name is a display and download name, so it stays one plain name (no path, no control
 * characters), has something before the extension, and keeps the extension of the file: the stored type does not change with a rename.
 */
export declare function renameProblem(current: string, next: string): NoticeRef | null;

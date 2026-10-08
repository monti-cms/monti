import type { Cms } from "../../../cms/index.js";
/**
 * The two steps of a media upload, shared by the upload routes: `prepareMediaUpload` registers the
 * asset and issues the direct upload URL, `completeMediaUpload` inspects the stored file and makes the asset usable. Both throw `HttpError`.
 */
export interface PreparedMediaUpload {
    readonly mediaId: string;
    readonly uploadUrl: string;
    readonly method: "PUT";
    readonly requiredHeaders: Record<string, string>;
    readonly expiresAt: string;
    readonly original?: {
        readonly uploadUrl: string;
        readonly method: "PUT";
        readonly requiredHeaders: Record<string, string>;
        readonly expiresAt: string;
    };
}
/** The server decides the allowed type, size and file key. `raw` is the request body of `POST /media/uploads`. */
export declare function prepareMediaUpload(cms: Cms, raw: unknown): Promise<PreparedMediaUpload>;
/** Inspects the stored file by its bytes and promotes it. The asset is `ready` afterwards; a file that fails inspection leaves it `failed`. */
export declare function completeMediaUpload(cms: Cms, mediaId: string): Promise<{
    mediaId: string;
    status: string;
    publicUrl: string | null;
    width: number | null;
    height: number | null;
    byteSize: number | null;
    mimeType: string | null;
    defaultAlt: string;
    defaultCaption: string;
}>;

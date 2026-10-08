import { type Site } from "@monti-cms/core/client";
/**
 * Browser image upload. Shared by the editor and the media library.
 *
 * 1. (Optional) Web optimization: converts static JPEG, PNG, and WebP to WebP with the long edge at most 2560px. The original is kept as part of the same media.
 * 2. Asks the server to prepare the upload and uploads directly to storage with the returned URL (the file does not pass through the app server).
 * 3. Requests completion confirmation. The server marks it `ready` only after inspecting the actual bytes.
 */
export interface OptimizePolicy {
    /** Formats to convert. Animated GIF and WebP, and formats with uncertain support, keep the original. */
    readonly formats: readonly string[];
    readonly maxEdge: number;
    readonly quality: number;
    readonly outputType: "image/webp";
    /** Name of the converted file. */
    readonly rename: (name: string) => string;
}
/** Default optimization policy. Can be changed in code. */
export declare const DEFAULT_OPTIMIZE_POLICY: OptimizePolicy;
export interface PreparedUpload {
    /** File to upload for public use. The original as is if not optimized. */
    file: File;
    /** The original file, when optimized. */
    original?: File;
    optimized: boolean;
    /** Why optimization was skipped (for user-facing messages). */
    skippedReason?: string;
    width?: number;
    height?: number;
}
/**
 * Web optimization. If it cannot convert or conversion is not a gain, returns the original as is and records the reason.
 * Never silently turns an animation into a still image.
 */
export declare function prepareUpload(site: Site, file: File, options?: {
    optimize: boolean;
    policy?: OptimizePolicy;
}): Promise<PreparedUpload>;
export interface UploadedMedia {
    mediaId: string;
    publicUrl: string | null;
    width: number;
    height: number;
    defaultAlt: string;
    defaultCaption: string;
}
export declare function uploadImageFile(site: Site, input: File | PreparedUpload, onProgress?: (percent: number) => void): Promise<UploadedMedia>;
export declare const formatBytes: (bytes: number) => string;
/**
 * Uploads an attachment file. The format is decided by the file name extension (browsers give inconsistent types for code files).
 * Rejects before uploading if the format is not accepted or the site setting limit (`media.maxFileBytes`) is exceeded.
 */
export declare function uploadAttachment(site: Site, file: File, onProgress?: (percent: number) => void): Promise<{
    mediaId: string;
}>;

import type { ContentStore } from "../core/store/index.js";
import type { MediaStore } from "../media/store.js";
/** Uploads that never completed are cleaned up after this long. */
export declare const STALE_UPLOAD_AFTER_MS: number;
export interface MediaServiceDeps {
    readonly store: () => Pick<ContentStore, "beginMediaDelete" | "finalizeMediaDelete" | "listStaleUploads">;
    readonly mediaStore: () => Pick<MediaStore, "deleteFile">;
    /** For tests: the clock. */
    readonly now?: () => Date;
}
export interface MediaService {
    /**
     * Deletes a file that nothing uses. Marks the row `deleting` (which fails with `in_use` when something refers to it), deletes its files, and removes the row.
     * If deleting a file fails, the `deleting` row stays and the call can be repeated.
     */
    delete(id: string): Promise<void>;
    /**
     * Removes incomplete or failed uploads older than 24 hours. An upload whose file deletion fails is kept and retried at the next cleanup; the ids that
     * failed are in `failed`.
     */
    cleanup(): Promise<{
        readonly removed: number;
        readonly failed: readonly string[];
    }>;
}
export declare function createMediaService(deps: MediaServiceDeps): MediaService;

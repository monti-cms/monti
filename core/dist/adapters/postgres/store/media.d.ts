import { type StoreContext } from "./context.js";
import type { CompleteMediaAssetInput, CreateMediaAssetInput, ListMediaParams, ListMediaResult, MediaAssetRecord } from "./types.js";
/** Media metadata. The file itself is handled by `MediaStore` (R2). */
export declare function createMediaOps(ctx: StoreContext): {
    createMediaAsset: (input: CreateMediaAssetInput) => Promise<MediaAssetRecord>;
    getMediaAsset: (id: string) => Promise<MediaAssetRecord | null>;
    completeMediaAsset: (input: CompleteMediaAssetInput) => Promise<MediaAssetRecord>;
    failMediaAsset: (id: string) => Promise<void>;
    /** The library's default alt and caption. They are copied only on insert, so bodies already written do not change. */
    updateMediaMetadata: (params: {
        id: string;
        filename?: string;
        defaultAlt?: string;
        defaultCaption?: string;
    }) => Promise<MediaAssetRecord>;
    /** Library: only completed and deleting files are shown. Files waiting for upload are targets of the cleanup job. */
    listMediaAssets: (params?: ListMediaParams) => Promise<ListMediaResult>;
    /**
     * Delete step 1: checks the media is not in use and sets it to `deleting`. When the file deletion finishes,
     * {@link finalizeMediaDelete} removes the row. If storage deletion fails, the `deleting` row remains so it can be retried.
     *
     * Besides the reference index, it also checks raw bodies, metadata, and templates: if an unparsed draft or template uses this media,
     * usage cannot be confirmed, so deletion is held. Metadata saved before media fields (`fields.media`) existed is checked too,
     * so values not yet in the reference index (media IDs kept in text fields) are not deleted.
     */
    beginMediaDelete: (id: string) => Promise<MediaAssetRecord>;
    /** Delete step 2: removes the row after confirming the file was deleted. */
    finalizeMediaDelete: (id: string) => Promise<void>;
    /** Cleanup targets: incomplete (`pending`) and failed (`failed`) uploads older than the cutoff time. */
    listStaleUploads: (params: {
        before: Date;
    }) => Promise<MediaAssetRecord[]>;
};

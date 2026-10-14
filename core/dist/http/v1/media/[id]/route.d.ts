type IdParams = {
    id: string;
};
/** Media detail. Also used when the editor shows an image from `mediaId` alone (including a check of the stored file). */
export declare const GET: import("../../handler.js").AdminHandler<IdParams>;
/** Edits the default alt and caption. Bodies already written do not change. */
export declare const PATCH: import("../../handler.js").AdminHandler<IdParams>;
/**
 * Deletes only unused files. Marks the row `deleting`, deletes the file, and removes the row on success.
 * If storage deletion fails, the `deleting` row stays and can be retried.
 */
export declare const DELETE: import("../../handler.js").AdminHandler<IdParams>;
export {};

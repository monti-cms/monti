type IdParams = {
    id: string;
};
/** Preview before deleting: the number of entries directly in it and its child folders. */
export declare const GET: import("../../handler.js").AdminHandler<IdParams>;
/** Rename, reorder, and move a folder. Rejects cycles and duplicate names within the same parent. */
export declare const PATCH: import("../../handler.js").AdminHandler<IdParams>;
/** Deletes a folder. Entries directly in it and child folders move to the parent; entries are not deleted. */
export declare const DELETE: import("../../handler.js").AdminHandler<IdParams>;
export {};

type IdParams = {
    id: string;
};
/**
 * An entry and the translation group needed by the editor.
 * For a translation, also returns the source's latest draft metadata (`source`). The translation properties panel shows the shared values read-only.
 */
export declare const GET: import("../../handler.js").AdminHandler<IdParams>;
/** Saves the latest draft. Fields not sent keep their current draft values. */
export declare const PATCH: import("../../handler.js").AdminHandler<IdParams>;
/** Permanently deletes a trashed entry. Moving to trash is `POST /entries/:id/trash`. */
export declare const DELETE: import("../../handler.js").AdminHandler<IdParams>;
export {};

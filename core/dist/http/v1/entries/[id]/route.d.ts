type IdParams = {
    id: string;
};
/**
 * An entry and the translation group needed by the editor.
 * For a translation, also returns the source's latest draft metadata (`source`). The translation properties panel shows the shared values read-only.
 */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
/** Saves the latest draft. Fields not sent keep their current draft values. */
export declare const PATCH: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
/** Permanently deletes a trashed entry. Moving to trash is `POST /entries/:id/trash`. */
export declare const DELETE: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
export {};

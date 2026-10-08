type IdParams = {
    id: string;
};
/** Media detail. Also used when the editor shows an image from `mediaId` alone (including a check of the stored file). */
export declare const GET: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/** Edits the default alt and caption. Bodies already written do not change. */
export declare const PATCH: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/**
 * Deletes only unused files. Marks the row `deleting`, deletes the file, and removes the row on success.
 * If storage deletion fails, the `deleting` row stays and can be retried.
 */
export declare const DELETE: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export {};

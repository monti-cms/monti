type IdParams = {
    id: string;
};
/** Preview before deleting: the number of entries directly in it and its child folders. */
export declare const GET: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/** Rename, reorder, and move a folder. Rejects cycles and duplicate names within the same parent. */
export declare const PATCH: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/** Deletes a folder. Entries directly in it and child folders move to the parent; entries are not deleted. */
export declare const DELETE: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export {};

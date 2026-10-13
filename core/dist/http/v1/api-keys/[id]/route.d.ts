type IdParams = {
    id: string;
};
/** Renames a key, replaces its value, or both. Everything that uses the key keeps using it (it is the same key). */
export declare const PATCH: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/**
 * Deletes a key. A key that something uses is not deleted unless the request says `?force=true`: without it the answer is 409 `key_in_use` with the
 * places that would stop working (`details.uses`), so the admin can show them and ask again.
 */
export declare const DELETE: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export {};

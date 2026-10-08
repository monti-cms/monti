/**
 * Upload completion check. Marks the media `ready` only after the server inspects the stored file.
 * If the check fails, the media does not become usable and stays `failed`, to be cleaned up.
 */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;

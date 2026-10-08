/**
 * Admin export. GET is also open so it can be downloaded via a link. The archive holds the stored documents; `format=<name>` also writes every body as a text
 * file in that format.
 */
export declare const GET: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
export declare const POST: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

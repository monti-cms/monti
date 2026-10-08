/** `?format=<name>` adds `body` to each template: its document as text in that format. */
export declare const GET: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
/** The body is `doc`, or `body` with its `format`. With neither the template is empty. */
export declare const POST: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

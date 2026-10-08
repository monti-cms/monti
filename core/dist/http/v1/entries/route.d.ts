/** Per-collection list, search, filter, sort, and paging. */
export declare const GET: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
/** Create. The body is `doc`, or `body` with its `format`. For record collections (tags, categories, series) the service applies the public values together with creation. */
export declare const POST: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

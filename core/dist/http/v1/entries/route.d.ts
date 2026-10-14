/** Per-collection list, search, filter, sort, and paging. */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
/** Create. The body is `doc`, or `body` with its `format`. For record collections (tags, categories, series) the service applies the public values together with creation. */
export declare const POST: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;

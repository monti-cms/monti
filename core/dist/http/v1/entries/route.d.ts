/** Per-collection list, search, filter, sort, and paging. */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
/** Create. For record collections (tags, categories, series) the service applies the public values together with creation. */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;

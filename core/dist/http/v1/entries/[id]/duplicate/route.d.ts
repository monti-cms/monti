/** Duplicates the latest draft as a draft with a new ID, through the write pipeline. */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;

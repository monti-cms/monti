/** Checks an edit of the schema file without writing anything: the diff, the entries each change touches and the transforms to pick. 403 outside development like a save. */
export declare const POST: (request: Request, context?: Partial<import("../../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

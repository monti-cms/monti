/** Adds a connection. 409 if the version of the whole config differs. */
export declare const POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

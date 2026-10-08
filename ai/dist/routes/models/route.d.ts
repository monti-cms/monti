/**
 * Model list of a generation connection's address (`GET {address}/models`). A saved connection is called by `providerId`; before saving, by address and key.
 * The key is never returned to the browser. If the address gives no list, the list is empty and the screen has the user type the name.
 */
export declare const POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

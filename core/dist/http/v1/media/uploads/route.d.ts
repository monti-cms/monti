/**
 * Upload preparation. The server decides the allowed type, size, and file key, and issues a time-limited direct upload URL.
 * Credentials never reach the browser, and the file body does not pass through the app server.
 */
export declare const POST: (request: Request, context?: Partial<import("../../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

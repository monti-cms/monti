/**
 * Upload preparation. The server decides the allowed type, size, and file key, and issues a time-limited direct upload URL.
 * Credentials never reach the browser, and the file body does not pass through the app server.
 */
export declare const POST: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;

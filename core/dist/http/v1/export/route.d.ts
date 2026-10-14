/**
 * Admin export. GET is also open so it can be downloaded via a link. The archive holds the stored documents; `format=<name>` also writes every body as a text
 * file in that format.
 */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
export declare const POST: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;

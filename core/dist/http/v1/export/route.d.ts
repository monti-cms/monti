/**
 * Admin export. GET is also open so it can be downloaded via a link. The archive holds the stored documents; `format=<name>` also writes every body as a text
 * file in that format, and `ids` limits it to those entries and their translations (`GET /export/summary` says what it would hold).
 */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
export declare const POST: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;

/** `?format=<name>` adds `body` to each template: its document as text in that format. */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
/** The body is `doc`, or `body` with its `format`. With neither the template is empty. */
export declare const POST: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;

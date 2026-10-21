/**
 * What an export with the same options (`scope`, `ids`, `format`) would hold, in counts: the entries (and how many of them are translations added to the
 * selection), the templates, folders, addresses and media records. Nothing is built. `POST` takes the options in the body, for a long list of `ids`.
 */
export declare const GET: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;
export declare const POST: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;

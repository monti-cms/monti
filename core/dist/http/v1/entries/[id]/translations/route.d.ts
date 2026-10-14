type IdParams = {
    id: string;
};
/** The source and translations in the same translation group. */
export declare const GET: import("../../../handler.js").AdminHandler<IdParams>;
/** Creates a translation: a draft copying the source's per-locale values and body. */
export declare const POST: import("../../../handler.js").AdminHandler<IdParams>;
export {};

type IdParams = {
    id: string;
};
/** The source and translations in the same translation group. */
export declare const GET: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/** Creates a translation: a draft copying the source's per-locale values and body. */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export {};

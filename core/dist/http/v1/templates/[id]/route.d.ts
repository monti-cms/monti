type IdParams = {
    id: string;
};
export declare const GET: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
/** Without a body the stored one is kept. Blocks keep their ids where the new body pairs with the old one. */
export declare const PATCH: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export declare const DELETE: (request: Request, context?: Partial<import("../../handler.js").RouteContext<IdParams>> | undefined) => Promise<Response>;
export {};

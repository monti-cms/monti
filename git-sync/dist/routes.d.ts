import { syncContextFor } from "./sync.js";
export declare const status: {
    GET: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
        [x: string]: string;
    }>> | undefined) => Promise<Response>;
};
export declare const settings: {
    GET: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
        [x: string]: string;
    }>> | undefined) => Promise<Response>;
    PUT: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
        [x: string]: string;
    }>> | undefined) => Promise<Response>;
};
export declare const pull: {
    POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<Record<string, string>>> | undefined) => Promise<Response>;
};
export declare const flush: {
    POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<Record<string, string>>> | undefined) => Promise<Response>;
};
export declare const conflicts: {
    GET: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<Record<string, string>>> | undefined) => Promise<Response>;
};
export declare const resolve: {
    POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<Record<string, string>>> | undefined) => Promise<Response>;
};
/** GitHub's `push` webhook. Public: the signature is the check, and nothing else about the request is trusted. */
export declare const webhook: {
    POST: (request: Request, context: {
        cms: Parameters<typeof syncContextFor>[0];
    }) => Promise<Response>;
};

import type { NextRequest } from "next/server";
/**
 * Admin API (`/api/cms/v1/*`) route table. The app exports `createCmsRouteHandler()` from a single catch-all route
 * (`app/api/cms/[...path]/route.ts`). Paths mirror the Next route folders (`[id]` is one segment).
 */
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
/** Route file. Handler params (`{ id }` etc.) differ per route, so they are called as `RouteHandler`. */
type RouteModule = Partial<Record<Method, unknown>>;
type CompiledRoute = {
    segments: string[];
    module: RouteModule;
    guarded: boolean;
};
/** The route and params matching the path segments. Named segments match before `[name]` segments (table order). */
export declare function matchRoute(path: readonly string[], routes?: readonly CompiledRoute[]): {
    module: RouteModule;
    params: Record<string, string>;
    guarded: boolean;
} | null;
/** Registered admin API paths (for docs and tests). */
export declare const CMS_ROUTE_PATTERNS: readonly string[];
/**
 * Catch-all route handler. `params.path` holds the path segments after `/api/cms/` (e.g. `["v1", "entries", "<id>"]`).
 * Unknown paths return 404; a known path with an unsupported method returns 405. `auth/*` is forwarded to the auth handler
 * when the auth base path is the default (`/api/cms/auth`), so no separate auth route file is needed.
 */
export type CmsRouteHandler = (request: NextRequest, context: {
    params: Promise<{
        path: string[];
    }>;
}) => Promise<Response>;
export declare function createCmsRouteHandler(): Record<Method, CmsRouteHandler>;
export {};

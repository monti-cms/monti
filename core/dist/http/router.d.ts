import type { Cms, HandleOptions } from "../cms/index.js";
/**
 * Admin API (`/api/monti/v1/*`) route table, served by `cms.handle(request)` (a Next app mounts it with `createRouteHandler(cms)` of `@monti-cms/nextjs` from a single catch-all route,
 * `app/api/monti/[...path]/route.ts`). Paths mirror the route folders (`[id]` is one segment).
 * Every route gets the CMS instance in its context (`{ params, cms }`).
 */
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
/** A method of a route file: `route(...)` for an admin route, `publicRoute(...)` for one marked `public`. The params (`{ id }` etc.) differ per route. */
type RouteModule = Partial<Record<Method, unknown>>;
type CompiledRoute = {
    segments: string[];
    module: RouteModule;
    public: boolean;
};
/** The route and params matching the path segments. Named segments match before `[name]` segments (table order). */
export declare function matchRoute(path: readonly string[], routes?: readonly CompiledRoute[]): {
    module: RouteModule;
    params: Record<string, string>;
    public: boolean;
} | null;
/** Registered admin API paths (for docs and tests). */
export declare const CMS_ROUTE_PATTERNS: readonly string[];
/**
 * The path segments after the API prefix (`/api/monti/`), read from the request URL: `["v1", "entries", "<id>"]` for `/api/monti/v1/entries/<id>`.
 * The site's `basePath` is skipped when the URL has it. `null` if the URL is not under the API prefix.
 */
export declare function pathFromRequest(request: Request): string[] | null;
/**
 * The request handler of one CMS instance (`cms.handle()` calls it): standard `Request` in, `Response` out, no framework types.
 * `auth/*` is forwarded to the auth handler when the auth base path is the default (`/api/monti/auth`), so no separate auth route file is needed.
 */
export declare function createRequestHandler(cms: Cms): (request: Request, options?: HandleOptions) => Promise<Response>;
export {};

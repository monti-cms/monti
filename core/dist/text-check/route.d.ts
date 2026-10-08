import type { Cms } from "../cms/index.js";
import { type TextCheckRouteOptions } from "./server-handler.js";
export { handleTextCheck, parseTextCheckBody, type ServerTextCheck, type TextCheckResponse, type TextCheckRouteOptions, } from "./server-handler.js";
/**
 * Server route for spelling and sentence checks (`@monti-cms/core/plugin/server`). Only admins can call it (core admin auth and same-origin check),
 * it takes `{ segments }` and returns `{ issues }`. The browser side calls this route with `remoteTextChecker({ url })`.
 *
 * ```ts
 * // app/api/text-check/route.ts
 * export const POST = textCheckRoute({
 *   cms,
 *   check: async (segments, { signal }) => callMyProvider(segments, process.env.MY_API_KEY, signal),
 * });
 * ```
 *
 * A route file of the app names its instance with `cms`. A route a plugin lists in its `routes` is served by `cms.handle()`, which passes the instance, so it needs no `cms`.
 */
export declare function textCheckRoute(options: TextCheckRouteOptions & {
    readonly cms?: Cms;
}): (request: Request, context?: Partial<import("../plugin-server.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

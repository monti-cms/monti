import { type TextCheckRouteOptions } from "./server-handler.js";
export { handleTextCheck, parseTextCheckBody, type ServerTextCheck, type TextCheckResponse, type TextCheckRouteOptions, } from "./server-handler.js";
/**
 * Server route for spelling and sentence checks (`@monti-cms/core/plugin/server`). Only admins can call it (core admin auth and same-origin check),
 * it takes `{ segments }` and returns `{ issues }`. The browser side calls this route with `remoteTextChecker({ url })`.
 *
 * ```ts
 * // app/api/text-check/route.ts
 * export const POST = textCheckRoute({
 *   check: async (segments, { signal }) => callMyProvider(segments, process.env.MY_API_KEY, signal),
 * });
 * ```
 */
export declare function textCheckRoute(options: TextCheckRouteOptions): (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;

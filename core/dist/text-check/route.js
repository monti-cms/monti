import { adminRoute, json, readJsonBody } from "../http/v1/handler.js";
import { handleTextCheck } from "./server-handler.js";
export { handleTextCheck, parseTextCheckBody, } from "./server-handler.js";
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
export function textCheckRoute(options) {
    return adminRoute(async ({ request }) => {
        const result = await handleTextCheck(await readJsonBody(request), options, request.signal);
        return json(result.body, { status: result.status });
    });
}

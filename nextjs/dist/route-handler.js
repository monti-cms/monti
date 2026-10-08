import { assertCms } from "./assert-cms.js";
import { nextHost } from "./auth/host.js";
/**
 * The Next adapter of `cms.handle()`: one handler per HTTP method for `app/api/cms/[...path]/route.ts`.
 * It only passes the request and the path segments Next already split on to the core handler, and attaches the Next request headers to the instance
 * (`cms.attachHost(nextHost)`), so the login can read the session and the dev bypass can see the request without anything in `monti.config.ts`.
 *
 * ```ts
 * export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
 * ```
 */
export function createRouteHandler(cms) {
    assertCms(cms, "createRouteHandler(cms)");
    cms.attachHost?.(nextHost);
    const handler = async (request, context) => cms.handle(request, { path: (await context.params).path });
    return { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler };
}

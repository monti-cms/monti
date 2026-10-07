import type { Cms } from "@monti-cms/core/runtime";
import { assertCms } from "./assert-cms";
import { nextHost } from "./auth/host";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Catch-all route handler for a Next route file. `params.path` holds the path segments after `/api/cms/` (e.g. `["v1", "entries", "<id>"]`).
 * Unknown paths return 404; a known path with an unsupported method returns 405.
 * Next's `NextRequest` is a standard `Request`, so the handler needs no Next types.
 */
export type CmsRouteHandler = (request: Request, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;

/**
 * The Next adapter of `cms.handle()`: one handler per HTTP method for `app/api/cms/[...path]/route.ts`.
 * It only passes the request and the path segments Next already split on to the core handler, and attaches the Next request headers to the instance
 * (`cms.attachHost(nextHost)`), so the login can read the session and the dev bypass can see the request without anything in `monti.config.ts`.
 *
 * ```ts
 * export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
 * ```
 */
export function createRouteHandler(
	cms: Pick<Cms, "handle"> & Partial<Pick<Cms, "attachHost">>,
): Record<Method, CmsRouteHandler> {
	assertCms(cms, "createRouteHandler(cms)");
	cms.attachHost?.(nextHost);
	const handler: CmsRouteHandler = async (request, context) =>
		cms.handle(request, { path: (await context.params).path });
	return { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler };
}

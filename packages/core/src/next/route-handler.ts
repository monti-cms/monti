import type { Cms } from "../cms";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Catch-all route handler for a Next route file. `params.path` holds the path segments after `/api/cms/` (e.g. `["v1", "entries", "<id>"]`).
 * Unknown paths return 404; a known path with an unsupported method returns 405.
 * Next's `NextRequest` is a standard `Request`, so the handler needs no Next types.
 */
export type CmsRouteHandler = (request: Request, context: { params: Promise<{ path: string[] }> }) => Promise<Response>;

/**
 * The Next adapter of `cms.handle()`: one handler per HTTP method for `app/api/cms/[...path]/route.ts`.
 * It only passes the request and the path segments Next already split on to the core handler.
 */
export function nextRouteHandler(cms: Pick<Cms, "handle">): Record<Method, CmsRouteHandler> {
	const handler: CmsRouteHandler = async (request, context) =>
		cms.handle(request, { path: (await context.params).path });
	return { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler };
}

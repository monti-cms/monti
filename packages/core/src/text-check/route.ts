import type { Cms } from "../cms";
import { adminRoute, json, readJsonBody } from "../http/v1/handler";
import { handleTextCheck, type TextCheckRouteOptions } from "./server-handler";

export {
	handleTextCheck,
	parseTextCheckBody,
	type ServerTextCheck,
	type TextCheckResponse,
	type TextCheckRouteOptions,
} from "./server-handler";

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
 * A route file of the app names its instance with `cms`. A route a plugin lists in its `routes` is served by `cms.routeHandler()`, which passes the instance, so it needs no `cms`.
 */
export function textCheckRoute(options: TextCheckRouteOptions & { readonly cms?: Cms }) {
	return adminRoute(
		async ({ request }) => {
			const result = await handleTextCheck(await readJsonBody(request), options, request.signal);
			return json(result.body, { status: result.status });
		},
		{ cms: options.cms },
	);
}

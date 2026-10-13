import { z } from "zod";
import type { Cms } from "../../../../cms";
import { CmsError } from "../../error-handler";
import { ok, parseWith, publicRoute, readQuery, runAdminRoute } from "../../handler";

const querySchema = z.object({
	all: z
		.enum(["1", "true", "0", "false"])
		.transform((value) => value === "1" || value === "true")
		.optional(),
	limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const run = async (cms: Cms, request: Request) => {
	const query = parseWith(querySchema, readQuery(request), "Invalid query");
	const result = await cms.events.retry({ all: query.all, limit: query.limit });
	return ok({ ...result, counts: await cms.events.counts() });
};

const bearerOf = (request: Request): string | null =>
	/^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;

/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. It takes an admin session, or `Authorization: Bearer <events.retrySecret>` when the server config has a
 * `retrySecret` (a bearer request needs no same-origin check: it carries no cookie). The route is public for the router, because it decides the login itself.
 */
export const POST = publicRoute(async ({ request, params, cms }) => {
	const token = bearerOf(request);
	if (token === null)
		return runAdminRoute(cms, request, params, ({ request: admin, cms: instance }) => run(instance, admin));
	if (!cms.events.acceptsRetryToken(token)) throw new CmsError("Invalid retry token", "unauthorized");
	return run(cms, request);
});

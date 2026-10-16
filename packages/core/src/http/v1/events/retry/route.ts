import { z } from "zod";
import type { Cms } from "../../../../cms";
import { CmsError } from "../../error-handler";
import { bearerRoute, bearerTokenOf, ok, parseWith, readQuery } from "../../handler";

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

/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. Access `admin-or-bearer`: the router guards a request without a token like any admin route, and a bearer request
 * (`Authorization: Bearer <events.retrySecret>`, when the server config has a `retrySecret`) reaches this handler, which verifies the token. It carries no cookie, so it needs no same-origin check.
 */
export const POST = bearerRoute(async ({ request, auth, cms }) => {
	if (auth === null) {
		const token = bearerTokenOf(request);
		if (token === null || !cms.events.acceptsRetryToken(token))
			throw new CmsError("Invalid retry token", "unauthorized");
	}
	return run(cms, request);
});

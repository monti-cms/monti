import { z } from "zod";
import { HttpError, handleApiError } from "../../error-handler.js";
import { adminRoute, json, parseWith, readQuery } from "../../handler.js";
const querySchema = z.object({
    all: z
        .enum(["1", "true", "0", "false"])
        .transform((value) => value === "1" || value === "true")
        .optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
});
const run = async (cms, request) => {
    const query = parseWith(querySchema, readQuery(request), "Invalid query");
    const result = await cms.events.retry({ all: query.all, limit: query.limit });
    return json({ ...result, counts: await cms.events.counts() });
};
const bearerOf = (request) => /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
const asAdmin = adminRoute(async ({ request, cms }) => run(cms, request));
/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. It takes an admin session, or `Authorization: Bearer <events.retrySecret>` when the server config has a
 * `retrySecret` (a bearer request needs no same-origin check: it carries no cookie).
 */
export const POST = async (request, context) => {
    const token = bearerOf(request);
    if (token === null)
        return asAdmin(request, context);
    try {
        const cms = context?.cms;
        if (!cms)
            throw new Error("the events retry route was called without a CMS instance");
        if (!cms.events.acceptsRetryToken(token))
            throw new HttpError(401, "unauthorized", "Invalid retry token");
        return await run(cms, request);
    }
    catch (error) {
        return handleApiError(error);
    }
};

import { createApiKeyBodySchema } from "../../../core/api-keys.js";
import { adminRoute, ok, parseWith, readJsonBody } from "../handler.js";
/** The keys with the places that use them. Values are never part of it. */
export const GET = adminRoute(async ({ cms }) => ok(await cms.apiKeys.view()));
export const POST = adminRoute(async ({ request, cms }) => {
    const body = parseWith(createApiKeyBodySchema, await readJsonBody(request));
    return ok(await cms.apiKeys.add(body), { status: 201 });
});

import { type ApiKeyList, createApiKeyBodySchema } from "../../../core/api-keys";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** The keys with the places that use them. Values are never part of it. */
export const GET = adminRoute(async ({ cms }) =>
	json({ items: await cms.apiKeys.list(), secretsAvailable: cms.apiKeys.available } satisfies ApiKeyList),
);

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createApiKeyBodySchema, await readJsonBody(request));
	return json(await cms.apiKeys.add(body), { status: 201 });
});

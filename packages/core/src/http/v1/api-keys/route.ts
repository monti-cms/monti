import { type ApiKeyList, createApiKeyBodySchema } from "../../../core/api-keys";
import { adminRoute, ok, parseWith, readJsonBody } from "../handler";

/** The keys with the places that use them. Values are never part of it. */
export const GET = adminRoute(async ({ cms }) =>
	ok({
		items: await cms.apiKeys.list(),
		secretsAvailable: cms.apiKeys.available,
		slots: await cms.apiKeys.slots(),
	} satisfies ApiKeyList),
);

export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(createApiKeyBodySchema, await readJsonBody(request));
	return ok(await cms.apiKeys.add(body), { status: 201 });
});

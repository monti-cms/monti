import { adminRoute, ok, parseWith, readJsonBody } from "../handler";

export const GET = adminRoute(async ({ auth, cms }) => ok(await cms.preferencesService().get(auth.userId)));

/** Merges and saves per collection. Collections and keys not sent are kept. */
export const PUT = adminRoute(async ({ request, auth, cms }) => {
	const body = parseWith(cms.site.api.preferencesBodySchema, await readJsonBody(request), "Invalid preferences body");
	return ok({ preferences: await cms.preferencesService().update(auth.userId, body) });
});

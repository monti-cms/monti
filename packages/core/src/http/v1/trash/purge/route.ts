import { CmsError } from "../../error-handler";
import { bearerRoute, bearerTokenOf, ok } from "../../handler";

/**
 * `POST /v1/trash/purge`: deletes the units discarded more than 30 days ago (a folder counts from its own day). Access `admin-or-bearer`, like `/v1/events/retry`:
 * a cron job calls it with the events retry secret (`Authorization: Bearer ...`); an admin needs none. What entries still point at stays.
 */
export const POST = bearerRoute(async ({ request, auth, cms }) => {
	if (auth === null) {
		const token = bearerTokenOf(request);
		if (token === null || !cms.events.acceptsRetryToken(token))
			throw new CmsError("Invalid retry token", "unauthorized");
	}
	return ok(await cms.trashService().purge());
});

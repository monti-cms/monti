import { unlinkBodySchema } from "../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/**
 * Takes entries (`targetIds`) or every entry of a collection (`collection`) out of the relation fields of the other entries, in the working and the published
 * bodies. Each changed entry's version goes up once. Returns how many entries changed.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const body = parseWith(unlinkBodySchema, await readJsonBody(request));
	return ok(await cms.trashService().unlink(body));
});

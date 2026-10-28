import { trashItemsBodySchema } from "../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/** Puts units back, one result each in the order sent. A folder comes back with what was discarded with it; an entry from a trashed folder recreates the folder path. */
export const POST = adminRoute(async ({ request, cms }) => {
	const { items } = parseWith(trashItemsBodySchema, await readJsonBody(request));
	return ok({ results: await cms.trashService().restore(items) });
});

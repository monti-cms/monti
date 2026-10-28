import { trashItemsBodySchema } from "../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/**
 * Deletes units for good, one result each in the order sent. A unit that an entry outside it points at from a relation field is not deleted (`in_use`, with the
 * entries); links in a body never hold it back.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { items } = parseWith(trashItemsBodySchema, await readJsonBody(request));
	return ok({ results: await cms.trashService().delete(items) });
});

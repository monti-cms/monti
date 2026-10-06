import { getCmsBulkService } from "../../../container";
import { bulkBodySchema } from "../../../core/api";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** Bulk operations. Processed atomically per item, returning success or failure for each item. Every item goes through the same write pipeline as a single write. */
export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(bulkBodySchema, await readJsonBody(request));
	return json(await getCmsBulkService().run(body));
});

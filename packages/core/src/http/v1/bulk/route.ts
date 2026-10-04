import { getCmsContentStore } from "../../../container";
import { bulkBodySchema } from "../../../core/api";
import { createBulkService } from "../../../services/bulk-service";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** Bulk operations. Processed atomically per item, returning success or failure for each item. */
export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(bulkBodySchema, await readJsonBody(request));
	return json(await createBulkService(getCmsContentStore()).run(body));
});

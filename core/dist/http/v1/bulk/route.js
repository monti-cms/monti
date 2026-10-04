import { getCmsContentStore } from "../../../container.js";
import { bulkBodySchema } from "../../../core/api.js";
import { createBulkService } from "../../../services/bulk-service.js";
import { adminRoute, json, parseWith, readJsonBody } from "../handler.js";
/** Bulk operations. Processed atomically per item, returning success or failure for each item. */
export const POST = adminRoute(async ({ request }) => {
    const body = parseWith(bulkBodySchema, await readJsonBody(request));
    return json(await createBulkService(getCmsContentStore()).run(body));
});

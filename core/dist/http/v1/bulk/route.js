import { bulkBodySchema } from "../../../core/api.js";
import { adminRoute, json, parseWith, readJsonBody } from "../handler.js";
/** Bulk operations. Processed atomically per item, returning success or failure for each item. Every item goes through the same write pipeline as a single write. */
export const POST = adminRoute(async ({ request, cms }) => {
    const body = parseWith(bulkBodySchema, await readJsonBody(request));
    return json(await cms.bulkService().run(body));
});

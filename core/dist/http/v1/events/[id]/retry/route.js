import { z } from "zod";
import { HttpError } from "../../../error-handler.js";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler.js";
const bodySchema = z.object({ subscriber: z.string().min(1) });
/** `POST /v1/events/<id>/retry` with `{ subscriber }`: puts a failed or dead delivery back and tries it now. 404 when there is no such failed or dead delivery. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { subscriber } = parseWith(bodySchema, await readJsonBody(request));
    if (!(await cms.events.retryDelivery({ eventId: params.id, subscriber }))) {
        throw new HttpError(404, "not_found", "No failed or dead delivery to retry");
    }
    return json({ counts: await cms.events.counts() });
});

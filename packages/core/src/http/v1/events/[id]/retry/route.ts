import { z } from "zod";
import { CmsError } from "../../../error-handler";
import { adminRoute, ok, parseWith, readJsonBody } from "../../../handler";

const bodySchema = z.object({ subscriber: z.string().min(1) });

/** `POST /v1/events/<id>/retry` with `{ subscriber }`: puts a failed or dead delivery back and tries it now. 404 when there is no such failed or dead delivery. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { subscriber } = parseWith(bodySchema, await readJsonBody(request));
	if (!(await cms.events.retryDelivery({ eventId: params.id, subscriber }))) {
		throw new CmsError("No failed or dead delivery to retry", "not_found");
	}
	return ok({ counts: await cms.events.counts() });
});

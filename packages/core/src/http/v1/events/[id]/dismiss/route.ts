import { z } from "zod";
import { HttpError } from "../../../error-handler";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler";

const bodySchema = z.object({ subscriber: z.string().min(1) });

/** `POST /v1/events/<id>/dismiss` with `{ subscriber }`: gives up on a failed or dead delivery. 404 when there is no such failed or dead delivery. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { subscriber } = parseWith(bodySchema, await readJsonBody(request));
	if (!(await cms.events.dismiss({ eventId: params.id, subscriber }))) {
		throw new HttpError(404, "not_found", "No failed or dead delivery to dismiss");
	}
	return json({ counts: await cms.events.counts() });
});

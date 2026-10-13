import { z } from "zod";
import { CmsError } from "../../../error-handler";
import { adminRoute, ok, parseWith, readJsonBody } from "../../../handler";

const bodySchema = z.object({ subscriber: z.string().min(1) });

/** `POST /v1/events/<id>/dismiss` with `{ subscriber }`: gives up on a failed or dead delivery. 404 when there is no such failed or dead delivery. */
export const POST = adminRoute<{ id: string }>(async ({ request, params, cms }) => {
	const { subscriber } = parseWith(bodySchema, await readJsonBody(request));
	if (!(await cms.events.dismiss({ eventId: params.id, subscriber }))) {
		throw new CmsError("No failed or dead delivery to dismiss", "not_found");
	}
	return ok({ counts: await cms.events.counts() });
});

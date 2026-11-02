import { assignKeySlotBodySchema } from "../../../../core/api-keys";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/** Chooses which key of its service the slot of an installed plugin (`Plugin.keySlots`) reads, or goes back to the first one (`keyId: null`). */
export const PUT = adminRoute(async ({ request, cms }) => {
	const body = parseWith(assignKeySlotBodySchema, await readJsonBody(request));
	await cms.apiKeys.slot(body.plugin, body.slot).set(body.keyId);
	return ok(await cms.apiKeys.view());
});

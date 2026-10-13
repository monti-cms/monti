import { assignKeySlotBodySchema } from "../../../../core/api-keys";
import { adminRoute, ok, parseWith, readJsonBody } from "../../handler";

/**
 * Assigns a key to the slot of an installed plugin (`CmsPlugin.keySlots`), or clears it (`key: { use: "none" }`). A typed key is saved in the same transaction as the
 * assignment, named after the slot's service.
 */
export const PUT = adminRoute(async ({ request, cms }) => {
	const body = parseWith(assignKeySlotBodySchema, await readJsonBody(request));
	await cms.apiKeys.slot(body.plugin, body.slot).assign(body.key);
	return ok(await cms.apiKeys.view());
});

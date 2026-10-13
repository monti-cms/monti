import { assignKeySlotBodySchema } from "../../../../core/api-keys";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";

/**
 * Assigns a key to the slot of an installed plugin (`CmsPlugin.keySlots`), or clears it (`key: { use: "none" }`). A typed key is saved in the same transaction as the
 * assignment, named after the slot's service.
 */
export const PUT = adminRoute(async ({ request, cms }) => {
	const body = parseWith(assignKeySlotBodySchema, await readJsonBody(request));
	const service = (await cms.apiKeys.slots()).find(
		(entry) => entry.plugin === body.plugin && entry.slot === body.slot,
	)?.service;
	await cms.apiKeys.assignSlot(body.plugin, body.slot, body.key, { baseName: service ?? body.plugin });
	return json({
		items: await cms.apiKeys.list(),
		secretsAvailable: cms.apiKeys.available,
		slots: await cms.apiKeys.slots(),
	});
});

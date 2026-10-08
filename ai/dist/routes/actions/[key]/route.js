import { adminRoute, assertVersionPresent, json, parseWith, readJsonBody, readVersionQuery, } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { deleteCustomAction, updateAction } from "../../../actions.js";
import { aiStoreFor } from "../../../store.js";
const patchSchema = z.object({ expectedVersion: z.number().int().min(0), value: z.unknown(), base: z.unknown() });
/**
 * Saves editable values (enable, accept requests, connection, model, input to send, instructions, thresholds, checks). Values equal to the defaults are not kept.
 * Screen actions also edit `base` (name, where it attaches, result shape).
 */
export const PATCH = adminRoute(async ({ request, params, cms }) => {
    const body = await readJsonBody(request);
    assertVersionPresent(body?.expectedVersion);
    const { expectedVersion, value, base } = parseWith(patchSchema, body);
    return json(await updateAction(cms.site, aiStoreFor(cms), params.key, expectedVersion, value, base));
});
/** Deletes a screen action (`?expectedVersion=`). Code actions cannot be deleted. */
export const DELETE = adminRoute(async ({ request, params, cms }) => {
    await deleteCustomAction(cms.site, aiStoreFor(cms), params.key, readVersionQuery(request));
    return new Response(null, { status: 204 });
});

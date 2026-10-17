import { adminRoute, ok, readVersionedBody } from "@monti-cms/core/server";
import { z } from "zod";
import { resetAction } from "../../../../actions.js";
import { aiStoreFor } from "../../../../store.js";
/** Resets an action to its defaults (the definition in the site config). Whether it is on stays as the current value. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion } = await readVersionedBody(request, z.object({ expectedVersion: z.number().int().min(0) }));
    return ok(await resetAction(cms.site, aiStoreFor(cms), params.key, expectedVersion));
});

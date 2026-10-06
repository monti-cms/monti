import { adminRoute, json, readVersionedBody } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { resetAction } from "../../../../actions";
import { aiStoreFor } from "../../../../store";

type KeyParams = { key: string };

/** Resets an action to its defaults (the definition in the site config). Whether it is on stays as the current value. */
export const POST = adminRoute<KeyParams>(async ({ request, params, cms }) => {
	const { expectedVersion } = await readVersionedBody(request, z.object({ expectedVersion: z.number().int().min(0) }));
	return json(await resetAction(aiStoreFor(cms), params.key, expectedVersion));
});

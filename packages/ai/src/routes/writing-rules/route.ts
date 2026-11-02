import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { aiStoreFor } from "../../store";

/** Most characters the writing rules hold. */
export const MAX_WRITING_RULES = 4000;

/** The site's writing rules (Settings › Site › Writing rules) and their version. */
export const GET = adminRoute(async ({ cms }) => ok(await aiStoreFor(cms).getWritingRulesRow()));

const bodySchema = z.object({ expectedVersion: z.number().int().min(0), text: z.string().max(MAX_WRITING_RULES) });

/** Saves the writing rules. 409 if they were saved since `expectedVersion`. */
export const PUT = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, text } = parseWith(bodySchema, await readJsonBody(request));
	const store = aiStoreFor(cms);
	await store.saveWritingRules({ expectedVersion, text });
	return ok(await store.getWritingRulesRow());
});

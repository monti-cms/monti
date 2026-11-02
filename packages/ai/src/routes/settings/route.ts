import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { z } from "zod";
import { aiQuickRequestSchema, aiUnopenedRequestSchema } from "../../connection";
import { getAiSettingsView, setQuickModel, setUnopenedDays } from "../../settings";
import { aiStoreFor } from "../../store";

/** The keys of AI services, the quick-task model, the model a new conversation starts with, and what is known of each model's tool calling. No key values. */
export const GET = adminRoute(async ({ cms }) => ok(await getAiSettingsView(cms.site, aiStoreFor(cms))));

/** Chooses the quick-task model, or how long an unopened conversation is kept. 409 if the version of the settings differs. */
export const PUT = adminRoute(async ({ request, cms }) => {
	const body = parseWith(z.union([aiQuickRequestSchema, aiUnopenedRequestSchema]), await readJsonBody(request));
	const store = aiStoreFor(cms);
	return ok(
		"quick" in body
			? await setQuickModel(cms.site, store, body.expectedVersion, body.quick)
			: await setUnopenedDays(cms.site, store, body.expectedVersion, body.unopenedDays),
	);
});

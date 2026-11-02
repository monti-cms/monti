import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { aiQuickRequestSchema } from "../../connection";
import { getAiSettingsView, setQuickModel } from "../../settings";
import { aiStoreFor } from "../../store";

/** The keys of AI services, the quick-task model, the model a new conversation starts with, and what is known of each model's tool calling. No key values. */
export const GET = adminRoute(async ({ cms }) => ok(await getAiSettingsView(cms.site, aiStoreFor(cms))));

/** Chooses the quick-task model. 409 if the version of the settings differs. */
export const PUT = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, quick } = parseWith(aiQuickRequestSchema, await readJsonBody(request));
	return ok(await setQuickModel(cms.site, aiStoreFor(cms), expectedVersion, quick));
});

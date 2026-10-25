import { adminRoute, ok, parseWith, readJsonBody } from "@monti-cms/core/server";
import { aiAgentRequestSchema } from "../../connection";
import { getAiSettingsView, setAgentModel } from "../../settings";
import { aiStoreFor } from "../../store";

/** List of saved AI connections, the model of the admin agent, and what is known of each model's tool calling. Keys are returned as only the last four characters. */
export const GET = adminRoute(async ({ cms }) => ok(await getAiSettingsView(cms.site, aiStoreFor(cms))));

/** Chooses the model the admin agent runs on (`agent: null`: the first ready chat connection with its default model). 409 if the version of the whole config differs. */
export const PUT = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, agent } = parseWith(aiAgentRequestSchema, await readJsonBody(request));
	return ok(await setAgentModel(cms.site, aiStoreFor(cms), expectedVersion, agent));
});

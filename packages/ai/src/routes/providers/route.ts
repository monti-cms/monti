import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { aiProviderRequestSchema } from "../../connection";
import { addAiProvider } from "../../settings";
import { getAiStore } from "../../store";

/** Adds a connection. 409 if the version of the whole config differs. */
export const POST = adminRoute(async ({ request }) => {
	const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
	return json(await addAiProvider(getAiStore(), expectedVersion, provider), { status: 201 });
});

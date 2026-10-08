import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { aiProviderRequestSchema } from "../../connection.js";
import { addAiProvider } from "../../settings.js";
import { aiStoreFor } from "../../store.js";
/** Adds a connection. 409 if the version of the whole config differs. */
export const POST = adminRoute(async ({ request, cms }) => {
    const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
    return json(await addAiProvider(cms.site, aiStoreFor(cms), expectedVersion, provider), { status: 201 });
});

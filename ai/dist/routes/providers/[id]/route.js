import { adminRoute, json, parseWith, readJsonBody, readVersionQuery } from "@monti-cms/core/plugin/server";
import { aiProviderRequestSchema } from "../../../connection.js";
import { removeAiProvider, updateAiProvider } from "../../../settings.js";
import { getAiStore } from "../../../store.js";
/** Edits a connection. If the key is omitted, the stored key is kept (deleted if the address changed); `null` deletes it. */
export const PATCH = adminRoute(async ({ request, params }) => {
    const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
    return json(await updateAiProvider(getAiStore(), expectedVersion, params.id, provider));
});
/** Deletes a connection. Actions that chose it fall back to the first connection suited to their kind. */
export const DELETE = adminRoute(async ({ request, params }) => json(await removeAiProvider(getAiStore(), readVersionQuery(request), params.id)));

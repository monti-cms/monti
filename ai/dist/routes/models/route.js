import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { aiModelsQuerySchema } from "../../connection.js";
import { isFakeAi, listModels } from "../../provider.js";
import { savedProvider } from "../../settings.js";
import { getAiStore } from "../../store.js";
/**
 * Model list of a generation connection's address (`GET {address}/models`). A saved connection is called by `providerId`; before saving, by address and key.
 * The key is never returned to the browser. If the address gives no list, the list is empty and the screen has the user type the name.
 */
export const POST = adminRoute(async ({ request }) => {
    const query = parseWith(aiModelsQuerySchema, await readJsonBody(request));
    const saved = query.providerId ? await savedProvider(getAiStore(), query.providerId) : null;
    if (saved && saved.kind !== "chat")
        return json({ items: [] });
    const url = query.url || saved?.url;
    if (!url)
        return json({ items: isFakeAi() ? [{ id: "fake-generator" }] : [] });
    // If the address changed but no new key was entered, the stored key is not sent to a different address.
    const apiKey = query.apiKey ?? (saved && saved.url === url ? saved.apiKey : null);
    return json({ items: await listModels(url, apiKey, request.signal) });
});

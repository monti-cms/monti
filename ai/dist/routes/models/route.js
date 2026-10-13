import { adminRoute, json, parseWith, readJsonBody } from "@monti-cms/core/plugin/server";
import { aiModelsQuerySchema } from "../../connection.js";
import { isFakeAi, listModels } from "../../provider.js";
import { savedProvider } from "../../settings.js";
import { aiStoreFor } from "../../store.js";
/**
 * Model list of a generation connection's address (`GET {address}/models`). A saved connection is called by `providerId`; before saving, by address and key.
 * The key is never returned to the browser. If the address gives no list, the list is empty and the screen has the user type the name.
 */
export const POST = adminRoute(async ({ request, cms }) => {
    const query = parseWith(aiModelsQuerySchema, await readJsonBody(request));
    const saved = query.providerId ? await savedProvider(aiStoreFor(cms), query.providerId) : null;
    if (saved && saved.kind !== "chat")
        return json({ items: [] });
    const url = query.url || saved?.url;
    if (!url)
        return json({ items: isFakeAi() ? [{ id: "fake-generator" }] : [] });
    // A key typed in the form, or one chosen from the store. If neither, the stored key of the connection, unless the address changed (it is not sent to a different address).
    const chosen = query.keyId ? await aiStoreFor(cms).apiKeys().read(query.keyId) : null;
    const apiKey = query.apiKey ?? chosen ?? (saved && saved.url === url ? saved.apiKey : null);
    return json({ items: await listModels(cms.site, url, apiKey, request.signal) });
});

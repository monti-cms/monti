import { getCmsContentStore } from "../../../container.js";
import { preferencesBodySchema } from "../../../core/api.js";
import { COLLECTIONS } from "../../../core/collections.js";
import { adminRoute, json, parseWith, readJsonBody } from "../handler.js";
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Normalizes stored preferences to the per-collection shape. Unknown or corrupt values are dropped. */
function normalize(stored) {
    const collections = {};
    for (const collection of COLLECTIONS) {
        const legacy = {
            ...(isObject(stored?.columnSettings?.[collection]) ? { columns: stored?.columnSettings?.[collection] } : {}),
            ...(stored?.defaultPageSize ? { pageSize: stored.defaultPageSize } : {}),
            ...(isObject(stored?.sort) ? { sort: stored.sort } : {}),
        };
        collections[collection] = { ...legacy, ...(stored?.collections?.[collection] ?? {}) };
    }
    const parsed = preferencesBodySchema.safeParse({ collections, editor: stored?.editor });
    return parsed.success ? parsed.data : {};
}
export const GET = adminRoute(async ({ auth }) => {
    const stored = await getCmsContentStore().getPreferences({ userId: auth.userId });
    return json(normalize(stored));
});
/** Merges and saves per collection. Collections and keys not sent are kept. */
export const PUT = adminRoute(async ({ request, auth }) => {
    const body = parseWith(preferencesBodySchema, await readJsonBody(request), "Invalid preferences body");
    const store = getCmsContentStore();
    const current = normalize((await store.getPreferences({ userId: auth.userId })));
    const collections = { ...current.collections };
    for (const [collection, value] of Object.entries(body.collections ?? {})) {
        const key = collection;
        collections[key] = { ...collections[key], ...value };
    }
    const preferences = { collections, editor: { ...current.editor, ...body.editor } };
    await store.savePreferences({ userId: auth.userId, preferences: preferences });
    return json({ success: true, preferences });
});

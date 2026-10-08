import { AI_COLLECTIONS } from "./collections.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import { aiSecrets, noSecretsOf } from "./secret.js";
const toRow = (item) => ({
    key: item.key,
    value: item.value,
    version: item.version,
    updatedAt: item.updatedAt,
});
/** Edited AI action values, connection settings and UI actions, kept in the AI plugin's storage. */
export function createAiStore(storage, 
/**
 * `site`: the site the store works for (the language of its errors). `secrets`: the AI plugin's secrets API for the stored service keys (`aiSecrets(cms)`). Without it,
 * keys cannot be stored or read.
 */
options) {
    const overrides = storage.collection(AI_COLLECTIONS.actionOverrides);
    const custom = storage.collection(AI_COLLECTIONS.customActions);
    const settings = storage.collection(AI_COLLECTIONS.settings);
    return {
        secrets: () => options.secrets?.() ?? noSecretsOf(options.site),
        /** All edited values, by action name. Actions never edited have none. */
        listAiActionOverrides: async () => (await overrides.list()).map(toRow),
        /**
         * Changes the edited values. The first time, `expectedVersion` is 0; after that, a different version gives 409.
         * If the edited values become empty (all defaults), the row is kept so the version carries on.
         */
        saveAiActionOverride: async (params) => toRow(await overrides.set(params.key, params.value, { expectedVersion: params.expectedVersion })),
        /**
         * One AI settings row (as stored). `default` is the service connection and `shared` is the edited shared text. `null` if none.
         */
        getAiSettings: async (id = "default") => {
            const item = await settings.get(id);
            return item ? { value: item.value, version: item.version } : null;
        },
        /** Saves one settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
        saveAiSettings: async (params) => (await settings.set(params.id ?? "default", params.value, { expectedVersion: params.expectedVersion })).version,
        /** All UI actions (actions created in the admin screen). In creation order. */
        listAiCustomActions: async () => (await custom.list())
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
            .map(toRow),
        /** Creates (`expectedVersion` 0) or edits a UI action. A different version gives 409. */
        saveAiCustomAction: async (params) => toRow(await custom.set(params.key, params.value, { expectedVersion: params.expectedVersion })),
        /** Deletes a UI action. A different version gives 409; if it does not exist, 404. */
        deleteAiCustomAction: async (params) => custom.delete(params.key, { expectedVersion: params.expectedVersion }),
    };
}
const stores = new WeakMap();
/** The AI store of one CMS instance, built from its plugin storage on first use. Each instance has its own. */
export function aiStoreFor(cms) {
    let store = stores.get(cms);
    if (!store) {
        store = createAiStore(cms.storage(AI_PLUGIN_NAME), { site: cms.site, secrets: () => aiSecrets(cms) });
        stores.set(cms, store);
    }
    return store;
}

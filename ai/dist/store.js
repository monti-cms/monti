import { AI_COLLECTIONS } from "./collections.js";
import { AiError } from "./errors.js";
import { AI_PLUGIN_NAME } from "./name.js";
import { providerMessages } from "./provider.messages.js";
const toRow = (item) => ({
    key: item.key,
    value: item.value,
    version: item.version,
    updatedAt: item.updatedAt,
});
/** Edited AI action values, connection settings and UI actions, kept in the AI plugin's storage. */
export function createAiStore(storage, 
/**
 * `site`: the site the store works for (the language of its errors). `apiKeys`: the instance's API key store (`() => cms.apiKeys`) the connections' keys live in.
 * Without it, keys cannot be stored or read.
 */
options) {
    const overrides = storage.collection(AI_COLLECTIONS.actionOverrides);
    const custom = storage.collection(AI_COLLECTIONS.customActions);
    const settings = storage.collection(AI_COLLECTIONS.settings);
    const holder = {};
    const built = {
        apiKeys: () => {
            if (!options.apiKeys)
                throw new AiError("service_unavailable", options.site.createTranslator(providerMessages)("noSecret"));
            return options.apiKeys();
        },
        /** Runs `work` with a store whose writes (settings and the key store) are one transaction: all kept, or none if it throws. */
        transaction: async (work) => options.transaction
            ? options.transaction((txStorage, txKeys) => work(createAiStore(txStorage, { site: options.site, apiKeys: () => txKeys })))
            : work(holder.current),
        /** All edited values, by action name. Actions never edited have none. */
        listAiActionOverrides: async () => (await overrides.list()).map(toRow),
        /**
         * Changes the edited values. The first time, `expectedVersion` is 0; after that, a different version gives 409.
         * If the edited values become empty (all defaults), the row is kept so the version carries on.
         */
        saveAiActionOverride: async (params) => toRow(await overrides.set(params.key, params.value, { expectedVersion: params.expectedVersion })),
        /**
         * One AI settings row (as stored). `default` is the service connection and `shared` is the edited prompt snippets (the stored row name `shared` is kept). `null` if none.
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
    holder.current = built;
    return built;
}
/** The AI store of one CMS instance, built from its plugin storage on first use. It is rebuilt when the site is reloaded (`cms.plugin(...).once`). */
export function aiStoreFor(cms) {
    const plugin = cms.plugin(AI_PLUGIN_NAME);
    return plugin.once("store", () => createAiStore(plugin.storage, {
        site: cms.site,
        apiKeys: () => cms.apiKeys,
        transaction: (work) => cms.transaction((tx) => work(tx.storage(AI_PLUGIN_NAME), tx.apiKeys)),
    }));
}

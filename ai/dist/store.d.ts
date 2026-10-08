import type { Site } from "@monti-cms/core/client";
import type { Cms, PluginSecrets, PluginStorage } from "@monti-cms/core/plugin/server";
/** Row name in the AI settings (collection `settings`). */
export type AiSettingsId = "default" | "shared";
/** One row of edited values per action name. */
export interface AiActionOverrideRow {
    key: string;
    /** Edited values that differ from the definition (shape of `aiActionOverrideSchema`). */
    value: unknown;
    version: number;
    updatedAt: Date;
}
/** Edited AI action values, connection settings and UI actions, kept in the AI plugin's storage. */
export declare function createAiStore(storage: PluginStorage, 
/**
 * `site`: the site the store works for (the language of its errors). `secrets`: the AI plugin's secrets API for the stored service keys (`aiSecrets(cms)`). Without it,
 * keys cannot be stored or read.
 */
options: {
    readonly site: Pick<Site, "createTranslator">;
    readonly secrets?: () => PluginSecrets;
}): {
    secrets: () => PluginSecrets;
    /** All edited values, by action name. Actions never edited have none. */
    listAiActionOverrides: () => Promise<AiActionOverrideRow[]>;
    /**
     * Changes the edited values. The first time, `expectedVersion` is 0; after that, a different version gives 409.
     * If the edited values become empty (all defaults), the row is kept so the version carries on.
     */
    saveAiActionOverride: (params: {
        key: string;
        expectedVersion: number;
        value: unknown;
    }) => Promise<AiActionOverrideRow>;
    /**
     * One AI settings row (as stored). `default` is the service connection and `shared` is the edited shared text. `null` if none.
     */
    getAiSettings: (id?: AiSettingsId) => Promise<{
        value: unknown;
        version: number;
    } | null>;
    /** Saves one settings row. The first time, `expectedVersion` is 0; after that, a different version gives 409. */
    saveAiSettings: (params: {
        id?: AiSettingsId;
        expectedVersion: number;
        value: unknown;
    }) => Promise<number>;
    /** All UI actions (actions created in the admin screen). In creation order. */
    listAiCustomActions: () => Promise<AiActionOverrideRow[]>;
    /** Creates (`expectedVersion` 0) or edits a UI action. A different version gives 409. */
    saveAiCustomAction: (params: {
        key: string;
        expectedVersion: number;
        value: unknown;
    }) => Promise<AiActionOverrideRow>;
    /** Deletes a UI action. A different version gives 409; if it does not exist, 404. */
    deleteAiCustomAction: (params: {
        key: string;
        expectedVersion: number;
    }) => Promise<void>;
};
export type AiStore = ReturnType<typeof createAiStore>;
/** The AI store of one CMS instance, built from its plugin storage on first use. Each instance has its own. */
export declare function aiStoreFor(cms: Cms): AiStore;

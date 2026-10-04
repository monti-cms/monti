import type { PluginDatabase } from "@monti-cms/core";
/** Row name in the AI settings table (`ai_settings`). */
export type AiSettingsId = "default" | "shared";
/** One row of edited values per action name. */
export interface AiActionOverrideRow {
    key: string;
    /** Edited values that differ from the definition (shape of `aiActionOverrideSchema`). */
    value: unknown;
    version: number;
    updatedAt: Date;
}
/** Edited AI action values (`ai_action_overrides`), connection settings (`ai_settings`) and UI actions (`ai_custom_actions`). */
export declare function createAiStore({ pool, schema: qSchema }: PluginDatabase): {
    /** All edited values. Actions never edited have none. */
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
declare global {
    var __cmsAiStore: AiStore | undefined;
}
/** AI store built from the main DB connection. Only one is kept even if the dev server reloads the module. */
export declare function getAiStore(): AiStore;

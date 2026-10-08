import type { Site } from "@monti-cms/core/client";
/**
 * Shared texts. Fill `{{shared.key}}` in the instructions of every action. There are two kinds.
 *
 * - **Config text**: text listed in the plugin config (`aiPlugin({ shared })`). The config decides keys and names; the admin screen edits only the
 *   content (only content differing from the default is kept). Cannot be deleted.
 * - **Added text**: text added in the admin screen by entering key, name and content. The key cannot be changed after creation; delete it if no action uses it.
 *
 * Both are kept in one `shared` row of the AI settings table as `{ texts: { key: edited content }, added: [{ key, label, text }] }`.
 * The old shape (config text key -> edited content) is also read, and saving changes it to the new shape.
 */
export interface AiSharedStore {
    getAiSettings(id: "shared"): Promise<{
        value: unknown;
        version: number;
    } | null>;
    saveAiSettings(params: {
        id: "shared";
        expectedVersion: number;
        value: unknown;
    }): Promise<number>;
}
/** One shared text shown in the admin screen. */
export type AiSharedItem = {
    source: "config";
    key: string;
    label: string;
    text: string;
    defaultText: string;
    overridden: boolean;
} | {
    source: "added";
    key: string;
    label: string;
    text: string;
};
export interface AiSharedView {
    version: number;
    /** Config texts (in config order), then added texts (in added order). */
    items: AiSharedItem[];
}
export declare const MAX_SHARED_TEXT = 4000;
export declare const MAX_SHARED_LABEL = 40;
/** Number of texts that can be added. */
export declare const MAX_ADDED_SHARED = 30;
/** Shared text key. Same as the config's naming rule (`validateAiConfig`). */
export declare const SHARED_KEY_PATTERN: RegExp;
/** Shared texts to show in the admin screen. */
export declare function getSharedView(site: Site, store: AiSharedStore): Promise<AiSharedView>;
/** Shared texts to put into the instructions (key -> content). Config texts have edited values applied, and added texts are included too. */
export declare function loadSharedTexts(site: Site, store: Pick<AiSharedStore, "getAiSettings">): Promise<Record<string, string>>;
/** Keys usable as `{{shared.key}}` in the instructions (config texts and added texts). Checked when saving instructions in the admin screen. */
export declare function loadSharedKeys(site: Site, store: Pick<AiSharedStore, "getAiSettings">): Promise<string[]>;
/** Adds a shared text. The body is `{ key, label, text }`. The key must not collide with config texts or added texts. */
export declare function addShared(site: Site, store: AiSharedStore, expectedVersion: number, input: unknown): Promise<AiSharedView>;
/**
 * Edits one shared text. The body is `{ key, label?, text }`. A config text edits only content (the config decides the name),
 * and an added text edits name and content. The key is not changed.
 */
export declare function updateSharedItem(site: Site, store: AiSharedStore, expectedVersion: number, input: unknown): Promise<AiSharedView>;
/**
 * Edits the content of several shared texts at once. The body is `{ texts: { key: content } }`, and texts not listed are left alone.
 * For config texts, an edited value equal to the default is removed. Unknown keys are rejected.
 */
export declare function updateShared(site: Site, store: AiSharedStore, expectedVersion: number, input: unknown): Promise<AiSharedView>;
/** Whether the instructions use this text as `{{shared.key}}`. */
export declare function usesShared(prompt: string, key: string): boolean;
/**
 * Deletes an added text. A config text cannot be deleted. If an action uses this text in its instructions (`features`: code action instructions and
 * edited instructions, UI actions), it is blocked and the action names are reported.
 */
export declare function deleteShared(site: Site, store: AiSharedStore, expectedVersion: number, key: string, features: readonly {
    readonly label: string;
    readonly prompt: string;
}[]): Promise<AiSharedView>;

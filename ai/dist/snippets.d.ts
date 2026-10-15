import type { Site } from "@monti-cms/core/client";
/**
 * Prompt snippets. Fill `{{snippet.key}}` in the instructions of every action. There are two kinds.
 *
 * - **Config text**: text listed in the plugin config (`ai({ snippets })`). The config decides keys and names; the admin screen edits only the
 *   content (only content differing from the default is kept). Cannot be deleted.
 * - **Added text**: text added in the admin screen by entering key, name and content. The key cannot be changed after creation; delete it if no action uses it.
 *
 * Both are kept in one `shared` row (the stored row name is kept) of the AI settings table as `{ texts: { key: edited content }, added: [{ key, label, text }] }`.
 * The old shape (config text key -> edited content) is also read, and saving changes it to the new shape.
 */
export interface AiSnippetStore {
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
/** One prompt snippet shown in the admin screen. */
export type AiSnippetItem = {
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
export interface AiSnippetView {
    version: number;
    /** Config texts (in config order), then added texts (in added order). */
    items: AiSnippetItem[];
}
export declare const MAX_SNIPPET_TEXT = 4000;
export declare const MAX_SNIPPET_LABEL = 40;
/** Number of texts that can be added. */
export declare const MAX_ADDED_SNIPPETS = 30;
/** Prompt snippet key. Same as the config's naming rule (`validateAiConfig`). */
export declare const SNIPPET_KEY_PATTERN: RegExp;
/** Prompt snippets to show in the admin screen. */
export declare function getSnippetView(site: Site, store: AiSnippetStore): Promise<AiSnippetView>;
/** Prompt snippets to put into the instructions (key -> content). Config texts have edited values applied, and added texts are included too. */
export declare function loadSnippets(site: Site, store: Pick<AiSnippetStore, "getAiSettings">): Promise<Record<string, string>>;
/** Keys usable as `{{snippet.key}}` in the instructions (config texts and added texts). Checked when saving instructions in the admin screen. */
export declare function loadSnippetKeys(site: Site, store: Pick<AiSnippetStore, "getAiSettings">): Promise<string[]>;
/** Adds a prompt snippet. The body is `{ key, label, text }`. The key must not collide with config texts or added texts. */
export declare function addSnippet(site: Site, store: AiSnippetStore, expectedVersion: number, input: unknown): Promise<AiSnippetView>;
/**
 * Edits one prompt snippet. The body is `{ key, label?, text }`. A config text edits only content (the config decides the name),
 * and an added text edits name and content. The key is not changed.
 */
export declare function updateSnippetItem(site: Site, store: AiSnippetStore, expectedVersion: number, input: unknown): Promise<AiSnippetView>;
/**
 * Edits the content of several prompt snippets at once. The body is `{ texts: { key: content } }`, and texts not listed are left alone.
 * For config texts, an edited value equal to the default is removed. Unknown keys are rejected.
 */
export declare function updateSnippets(site: Site, store: AiSnippetStore, expectedVersion: number, input: unknown): Promise<AiSnippetView>;
/** Whether the instructions use this text as `{{snippet.key}}`. */
export declare function usesSnippet(prompt: string, key: string): boolean;
/**
 * Deletes an added text. A config text cannot be deleted. If an action uses this text in its instructions (`features`: code action instructions and
 * edited instructions, UI actions), it is blocked and the action names are reported.
 */
export declare function deleteSnippet(site: Site, store: AiSnippetStore, expectedVersion: number, key: string, features: readonly {
    readonly label: string;
    readonly prompt: string;
}[]): Promise<AiSnippetView>;

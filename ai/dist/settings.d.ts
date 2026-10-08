import type { Site } from "@monti-cms/core/client";
import type { PluginSecrets } from "@monti-cms/core/plugin/server";
import type { ResolvedAiAction } from "./action.js";
import type { AiProviderInput, AiProviderKind, AiSettingsView } from "./connection.js";
import { type AiDecider, type AiProvider } from "./provider.js";
/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
    /** Secrets API of the AI plugin (`cms.secrets("ai")`) for the stored service keys. Read when a key is stored or used. */
    secrets(): PluginSecrets;
    getAiSettings(): Promise<{
        value: unknown;
        version: number;
    } | null>;
    saveAiSettings(params: {
        expectedVersion: number;
        value: unknown;
    }): Promise<number>;
}
export declare function getAiSettingsView(site: Site, store: AiSettingsStore): Promise<AiSettingsView>;
/**
 * Encrypts every stored key that is in the legacy format or was made with a previous secret again with the current secret (`monti migrate` runs it).
 * Keys that cannot be decrypted are left as they are. Does nothing when there is no current secret or nothing to upgrade, so it is safe to repeat.
 * A save of the connections that races with it wins (it also upgrades), so a version conflict is not an error.
 * @returns how many keys were upgraded
 */
export declare function upgradeStoredKeys(site: Site, store: AiSettingsStore): Promise<number>;
export declare function addAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, input: AiProviderInput): Promise<AiSettingsView>;
/** Edits a connection. If the key is omitted, the stored key stays; `null` deletes it; a string is encrypted and replaces it. */
export declare function updateAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, id: string, input: AiProviderInput): Promise<AiSettingsView>;
export declare function removeAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, id: string): Promise<AiSettingsView>;
/** URL and key of a stored connection (when fetching the model list). */
export declare function savedProvider(site: Site, store: AiSettingsStore, id: string): Promise<{
    kind: AiProviderKind;
    url: string;
    apiKey: string | null;
} | null>;
type ActionConnection = Pick<ResolvedAiAction, "engine" | "providerId" | "modelName">;
export interface AiRuntime {
    generator: AiProvider | null;
    decider: AiDecider | null;
}
/** Generation/decision models to run one action. Fills only the side matching the action's mode. */
export declare function loadAiRuntime(site: Site, store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime>;
/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export declare function usableActionKeys(site: Site, store: AiSettingsStore, actions: ReadonlyArray<ActionConnection & {
    key: string;
}>): Promise<string[]>;
/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * If no new key was entered, uses the key of a connection stored with the same URL (a key stored for a different URL is not sent).
 */
export declare function connectionForCheck(site: Site, store: AiSettingsStore, params: {
    providerId?: string;
    kind: AiProviderKind;
    url: string;
    apiKey?: string | null;
    model: string;
}): Promise<{
    model: string;
    generator?: AiProvider;
    decider?: AiDecider;
}>;
export {};

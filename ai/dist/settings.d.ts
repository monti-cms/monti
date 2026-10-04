import type { ResolvedAiAction } from "./action.js";
import type { AiProviderInput, AiProviderKind, AiSettingsView } from "./connection.js";
import { type AiDecider, type AiProvider } from "./provider.js";
/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
    getAiSettings(): Promise<{
        value: unknown;
        version: number;
    } | null>;
    saveAiSettings(params: {
        expectedVersion: number;
        value: unknown;
    }): Promise<number>;
}
export declare function getAiSettingsView(store: AiSettingsStore): Promise<AiSettingsView>;
export declare function addAiProvider(store: AiSettingsStore, expectedVersion: number, input: AiProviderInput): Promise<AiSettingsView>;
/** Edits a connection. If the key is omitted, the stored key stays; `null` deletes it; a string is encrypted and replaces it. */
export declare function updateAiProvider(store: AiSettingsStore, expectedVersion: number, id: string, input: AiProviderInput): Promise<AiSettingsView>;
export declare function removeAiProvider(store: AiSettingsStore, expectedVersion: number, id: string): Promise<AiSettingsView>;
/** URL and key of a stored connection (when fetching the model list). */
export declare function savedProvider(store: AiSettingsStore, id: string): Promise<{
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
export declare function loadAiRuntime(store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime>;
/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export declare function usableActionKeys(store: AiSettingsStore, actions: ReadonlyArray<ActionConnection & {
    key: string;
}>): Promise<string[]>;
/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * If no new key was entered, uses the key of a connection stored with the same URL (a key stored for a different URL is not sent).
 */
export declare function connectionForCheck(store: AiSettingsStore, params: {
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

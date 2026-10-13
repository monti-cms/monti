import type { ApiKeyChoiceInput, Site } from "@monti-cms/core/client";
import type { ApiKeys } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import type { ResolvedAiAction } from "./action.js";
import type { AiProviderInput, AiProviderKind, AiSettingsView } from "./connection.js";
import { type AiDecider, type AiProvider } from "./provider.js";
/** Settings store (part of the content store). Tests pass an in-memory implementation. */
export interface AiSettingsStore {
    /** The central API key store (`cms.apiKeys`): a connection keeps the id of its key, and the value is read from here when the service is called. */
    apiKeys(): ApiKeys;
    /** Runs `work` with a store whose writes (the settings and the key store) are one transaction: all kept, or none if it throws. */
    transaction<T>(work: (scoped: AiSettingsStore) => Promise<T>): Promise<T>;
    getAiSettings(): Promise<{
        value: unknown;
        version: number;
    } | null>;
    saveAiSettings(params: {
        expectedVersion: number;
        value: unknown;
    }): Promise<number>;
}
/** One connection kept in the DB. `keyId` is the id of a key in the central API key store (`null`: no key). */
declare const storedProviderSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        chat: "chat";
        decisions: "decisions";
    }>;
    url: z.ZodDefault<z.ZodString>;
    keyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    defaultModel: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
type StoredProvider = z.output<typeof storedProviderSchema>;
export declare function getAiSettingsView(site: Site, store: AiSettingsStore): Promise<AiSettingsView>;
/**
 * Tells the key store which connections use which key, so the API keys screen can list them and warn before a key is deleted. Only the reference
 * (`connection:<id>`) is stored; the text shown comes from {@link keyUseLabels} when the keys are read.
 */
export declare function reportKeyUses(store: AiSettingsStore, providers: readonly StoredProvider[]): Promise<void>;
export declare const connectionRef: (id: string) => string;
/**
 * The text for each connection that uses a key, in the admin language and with the connection's name as it is now (`null` for one that was deleted: its use is
 * dropped). The plugin's `keyUses`.
 */
export declare function keyUseLabels(site: Site, store: AiSettingsStore, refs: readonly string[]): Promise<Record<string, string | null>>;
export declare function addAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, input: AiProviderInput): Promise<AiSettingsView>;
/**
 * Edits a connection. If `key` is omitted, the connection keeps its key (unless the address changed: a key is not carried over to a different address silently).
 * Otherwise the chosen key is used: a saved one, a typed one saved as a new key, or none.
 */
export declare function updateAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, id: string, input: AiProviderInput): Promise<AiSettingsView>;
export declare function removeAiProvider(site: Site, store: AiSettingsStore, expectedVersion: number, id: string): Promise<AiSettingsView>;
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
export declare function loadAiRuntime(site: Site, store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime>;
/** Whether each action is usable now (whether to attach a button in the slot). Returns the names of usable actions. */
export declare function usableActionKeys(site: Site, store: AiSettingsStore, actions: ReadonlyArray<ActionConnection & {
    key: string;
}>): Promise<string[]>;
/**
 * Call setup used for connection checks. Built from the input values (URL, key, model) before saving.
 * The key is the one the form chose: a saved key, a typed one (used for the check only, not saved), or none. If the form says nothing about the key, the stored
 * connection's key is used when its address is the same (a key stored for a different address is not sent).
 */
export declare function connectionForCheck(site: Site, store: AiSettingsStore, params: {
    providerId?: string;
    kind: AiProviderKind;
    url: string;
    key?: ApiKeyChoiceInput;
    model: string;
}): Promise<{
    model: string;
    generator?: AiProvider;
    decider?: AiDecider;
}>;
export {};

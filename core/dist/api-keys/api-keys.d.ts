import { type ApiKeyChoiceInput, type ApiKeySlotView, type ApiKeyView } from "../core/api-keys.js";
import type { PluginStorage } from "../plugin/storage.js";
import type { PluginSecrets } from "../secrets/index.js";
/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (`cms.secrets("core-keys")`, derived from the server config's `secret`). A plugin that needs a key keeps the key's id, not its value, reads the value
 * on the server when it calls the service (`read`), and tells the store where it uses the key (`setUses`) so the admin can show it and warn before a delete.
 *
 * The value is never part of a view and never leaves the server.
 */
/** Name of the core's storage and secrets scope. */
export declare const API_KEYS_SCOPE = "core-keys";
export interface ApiKeys {
    /** The keys the installed plugins ask for (`CmsPlugin.keySlots`), each with the key assigned to it or `null`. */
    slots(): Promise<ApiKeySlotView[]>;
    /**
     * The value of the key assigned to a plugin's slot, for the server code that calls the service. `null` when no key is assigned, the key was deleted, or it cannot
     * be decrypted. Never send it to a browser.
     */
    readSlot(plugin: string, slot: string): Promise<string | null>;
    /** Assigns a saved key to a slot, or clears it with `null`. The slot must be one the plugin declared and installed. */
    setSlot(plugin: string, slot: string, keyId: string | null): Promise<void>;
    /**
     * Assigns what a form chose to a slot: a saved key, a typed value saved as a new key (named `baseName`, `baseName 2`, ... when taken) in the same transaction as the
     * assignment, or none (clears it). Either both are written or neither.
     */
    assignSlot(plugin: string, slot: string, choice: ApiKeyChoiceInput, options: {
        baseName: string;
    }): Promise<void>;
    /** Every key with the places that use it, by name. */
    list(): Promise<ApiKeyView[]>;
    get(id: string): Promise<ApiKeyView | null>;
    /** Whether keys can be saved (the server config has a `secret`). */
    readonly available: boolean;
    /** Saves a key under a name. A name another key has fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`. */
    add(input: {
        name: string;
        value: string;
    }): Promise<ApiKeyView>;
    /** Saves a key under `baseName`, or `baseName 2`, `baseName 3`, ... when that name is taken. */
    addNamed(input: {
        baseName: string;
        value: string;
    }): Promise<ApiKeyView>;
    /**
     * Turns what a form sent for a place's key into the id to keep: the id of a saved key (which must exist), the id of a key just saved from the typed value
     * (named `baseName`, or `baseName 2`, ... when taken), or `null` for no key.
     */
    choose(choice: ApiKeyChoiceInput, options: {
        baseName: string;
    }): Promise<string | null>;
    /** Renames and/or replaces the value. `expectedVersion` is the version read last; a different one fails with `conflict`. */
    update(id: string, input: {
        expectedVersion: number;
        name?: string;
        value?: string;
    }): Promise<ApiKeyView>;
    /**
     * Deletes a key and forgets where it was used. The plugins that used it keep its id and find no key behind it, so what used it stops working. The
     * admin API asks for confirmation first when `uses` is not empty.
     */
    remove(id: string, input: {
        expectedVersion: number;
    }): Promise<void>;
    /** The value of a key, for the server code that calls a service with it. `null` if there is no such key or it cannot be decrypted. Never send it to a browser. */
    read(id: string): Promise<string | null>;
    /**
     * Tells the store every item a plugin uses a key for (`ref`: a stable reference such as `connection:<id>`), replacing what it told before. An item that names a key
     * that does not exist is left out. A plugin calls it whenever the items change (a connection is saved or deleted). Only references are stored: the text the admin shows
     * comes from the plugin's `keyUses` when the keys are read, so it follows the admin language and the item's current name, and an item that no longer exists drops out.
     */
    setUses(plugin: string, uses: readonly {
        ref: string;
        keyId: string;
    }[]): Promise<void>;
}
export interface ApiKeysOptions {
    readonly storage: () => PluginStorage;
    readonly secrets: PluginSecrets;
    /**
     * The text for each item of a plugin that uses keys, in the admin language (the plugin's `keyUses`). `null` for an item that does not exist any more: its
     * use is dropped. A plugin that gives none is shown by its name.
     */
    /** The slots the installed plugins declare (`CmsPlugin.keySlots`), with their labels in the admin language. */
    readonly declared?: () => readonly {
        readonly plugin: string;
        readonly slot: string;
        readonly label: string;
        readonly service: string;
    }[];
    /** Runs work in one transaction with the key store (`cms.transaction`). Without it a typed key and its assignment are written one after the other. */
    readonly atomic?: <T>(work: (keys: ApiKeys) => Promise<T>) => Promise<T>;
    readonly labels?: (plugin: string, refs: readonly string[]) => Promise<Readonly<Record<string, string | null>>>;
}
export declare function createApiKeys(options: ApiKeysOptions): ApiKeys;
/**
 * `monti db:migrate`: uses written before only references were stored carry the text they were saved with (`label`). Takes it off, so nothing frozen in the language
 * of the moment is kept; the text is worked out when the keys are read. Safe to repeat.
 */
export declare function migrateKeyUses(storage: PluginStorage): Promise<void>;

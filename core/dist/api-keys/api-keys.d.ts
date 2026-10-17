import { type ApiKeyChoiceInput, type ApiKeyList, type ApiKeySlotView, type ApiKeyView } from "../core/api-keys.js";
import type { PluginStorage } from "../plugin/storage.js";
import type { PluginSecrets } from "../secrets/index.js";
/** One key slot of a plugin: where its server code reads the key, and what the admin sets. */
export interface ApiKeySlot {
    /** The value of the key assigned to the slot, for the server code that calls the service. `null` when none is assigned, the key was deleted, or it cannot be decrypted. Never send it to a browser. */
    read(): Promise<string | null>;
    /** Assigns a saved key, or clears the slot with `null`. */
    set(keyId: string | null): Promise<void>;
    /**
     * Assigns what a form chose: a saved key, a typed value saved as a new key (named after the slot's service, `Service 2` ... when taken) in the same
     * transaction as the assignment, or none (clears it).
     */
    assign(choice: ApiKeyChoiceInput): Promise<void>;
}
export interface ApiKeys {
    /** Whether keys can be saved (the server config has a `secret`). */
    readonly available: boolean;
    /** What the admin API answers: every key with the places that use it, whether keys can be saved, and the slots the installed plugins declare. */
    view(): Promise<ApiKeyList>;
    /** Every key with the places that use it, by name. */
    list(): Promise<ApiKeyView[]>;
    get(id: string): Promise<ApiKeyView | null>;
    /** The keys the installed plugins ask for (`Plugin.keySlots`), each with the key assigned to it or `null`. */
    slots(): Promise<ApiKeySlotView[]>;
    /** A slot of an installed plugin. It throws `not_found` when the plugin has no such slot. */
    slot(plugin: string, slot: string): ApiKeySlot;
    /** Saves a key under a name. A name another key has (in any case) fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`. */
    add(input: {
        name: string;
        value: string;
    }): Promise<ApiKeyView>;
    /** Saves a key under `baseName`, or `baseName 2`, `baseName 3`, ... when that name is taken. */
    addNamed(input: {
        baseName: string;
        value: string;
    }): Promise<ApiKeyView>;
    /** The saved key that has this value, or a new one named like {@link addNamed}. */
    findOrAdd(input: {
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
     * Deletes a key and forgets where it was used, in one transaction. A key that something uses is kept and the call fails with `key_in_use` (`details.uses` lists the
     * places that would stop working) unless `force` is set: then the plugins that used it keep its id and find no key behind it.
     */
    remove(id: string, input: {
        expectedVersion: number;
        force?: boolean;
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
     * use is not shown. A plugin that gives none is shown by its name.
     */
    readonly labels?: (plugin: string, refs: readonly string[]) => Promise<Readonly<Record<string, string | null>>>;
    /** The slots the installed plugins declare (`Plugin.keySlots`), with their labels in the admin language. */
    readonly declared?: () => readonly {
        readonly plugin: string;
        readonly slot: string;
        readonly label: string;
        readonly service: string;
    }[];
    /** Called after a slot was assigned or cleared and the change is saved (the slot's `onChange`). */
    readonly onSlotChange?: (plugin: string, slot: string) => Promise<void> | void;
    /**
     * Runs work in one transaction with the key store (`cms.transaction`): it hands the work a storage that reads and writes through the transaction. Every
     * write that touches more than one row runs through it. Without it the writes are made one after the other.
     */
    readonly transact?: <T>(work: (storage: () => PluginStorage) => Promise<T>) => Promise<T>;
}
export declare function createApiKeys(options: ApiKeysOptions): ApiKeys;

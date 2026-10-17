import type { ApiKeySlot, ApiKeys } from "../api-keys/api-keys.js";
import type { PluginSecrets } from "../secrets/index.js";
import type { PluginStorage } from "./storage.js";
/**
 * Everything a plugin keeps for one CMS instance, under its own name: its storage, its secrets, its API key slots, the API key store, and a cache that follows
 * the instance's site. A plugin's routes, hooks, commands and other server callbacks receive it as `plugin`; other code gets it with `cms.plugin("my-plugin")`.
 */
export interface PluginContext {
    /** The plugin this context belongs to. */
    readonly name: string;
    /** The plugin's storage: documents in named collections with optimistic versions, and `once` for one-time migration steps. */
    readonly storage: PluginStorage;
    /** The plugin's secrets: encryption of stored values and key derivation, with a key derived from the server config's `secret` and the plugin's name. */
    readonly secrets: PluginSecrets;
    /**
     * One of the plugin's API key slots (`keySlots` of the plugin definition): `plugin.key("api").read()` is the value of the key assigned to it, `null` when none is.
     * It throws `not_found` for a slot the plugin does not declare.
     */
    key(id: string): ApiKeySlot;
    /** The central API key store (`cms.apiKeys`): saved keys and the uses of each. */
    readonly apiKeys: ApiKeys;
    /**
     * Makes a value once per site and keeps it: the first call with a `key` runs `factory`, later calls return the same value. A development schema reload
     * (`cms.reloadSchema`) gives the instance a new site, and the cache starts empty again, so a value built from `cms.site` never holds a stale one. Use it for
     * the objects a plugin builds from its storage and the site (a store, a client); do not keep them in a module-level `WeakMap` keyed by the instance.
     */
    once<T>(key: string, factory: () => T): T;
}

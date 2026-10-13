import type { ApiKeys } from "../api-keys/api-keys";
import type { PluginSecrets } from "../secrets";
import type { PluginStorage } from "./storage";

/**
 * Everything a plugin keeps for one CMS instance, under its own name (`cms.plugin("my-plugin")`): its storage, its secrets, the API key store, and a cache
 * that follows the instance's site.
 */
export interface PluginContext {
	/** The plugin this context belongs to. */
	readonly name: string;
	/** Same as `cms.storage(name)`. */
	readonly storage: PluginStorage;
	/** Same as `cms.secrets(name)`. */
	readonly secrets: PluginSecrets;
	/** Same as `cms.apiKeys`. */
	readonly apiKeys: ApiKeys;
	/**
	 * Makes a value once per site and keeps it: the first call with a `key` runs `factory`, later calls return the same value. A development schema reload
	 * (`cms.reloadSchema`) gives the instance a new site, and the cache starts empty again, so a value built from `cms.site` never holds a stale one. Use it for
	 * the objects a plugin builds from its storage and the site (a store, a client); do not keep them in a module-level `WeakMap` keyed by the instance.
	 */
	once<T>(key: string, factory: () => T): T;
}

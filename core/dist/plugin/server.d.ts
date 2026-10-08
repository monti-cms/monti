import type { Cms } from "../cms/index.js";
import { type FormatRegistry } from "../format/registry.js";
import type { CmsServerConfig } from "../server/define.js";
import type { EventSubscriber } from "../services/events.js";
import type { HookSource } from "../services/hooks.js";
import type { CmsPlugin, CmsServerPlugin, OwnedPluginRoute } from "./define.js";
import type { PluginStorage } from "./storage.js";
/** The server side of a plugin, with the plugin's name. A plugin without a server side is empty. */
export type LoadedServerPlugin = CmsServerPlugin & {
    readonly name: string;
};
/**
 * The server side of one site's plugins, owned by one CMS instance (`createCms`): the loaded server modules, the route table, feature flags,
 * migrations, and the write hooks that run in order (server config first, then plugins).
 */
export interface ServerPlugins {
    /**
     * Loads the server side of the plugins. Read once on the first call and reused afterwards.
     * If loading fails, it is not remembered so the next call retries, and the error is rethrown as is.
     */
    load(): Promise<readonly LoadedServerPlugin[]>;
    /**
     * The formats of the instance: the built-in ones, then those of the plugins in the site config's order. Read once on the first call and reused afterwards.
     * A name provided twice fails here, and the failure is not remembered.
     */
    formats(): Promise<FormatRegistry>;
    /** Plugin API route table (in plugin order, tagged with the plugin each route belongs to). */
    routes(): Promise<readonly OwnedPluginRoute[]>;
    /**
     * Collects the feature flags plugins add to the meta API under each plugin's name (`{ ai: { ... } }`).
     * Plugins with no feature flags, or that fail, are left out.
     */
    features(): Promise<Record<string, Readonly<Record<string, boolean>>>>;
    /** Runs each plugin's migration hook with that plugin's storage. Called after the core tables are created (`monti migrate`). */
    migrate(storageOf: (plugin: string) => PluginStorage, log?: (message: string) => void): Promise<void>;
    /**
     * Write hooks in the order they run: the server config first, then the plugins in the site config's order. Each is tagged with its owner
     * (`server`, `plugin:<name>`), which a failing hook is reported with.
     */
    writeHooks(): Promise<readonly HookSource[]>;
    /**
     * The subscribers of the committed changes, in the order they are delivered to: the server config's `hooks.afterCommit`, then each plugin's. The name
     * is the hook's owner (`server`, `plugin:<name>`) and keys the delivery state of the outbox.
     */
    eventSubscribers(): Promise<readonly EventSubscriber[]>;
}
/** `cms` is the instance that owns these plugins. It is passed to the plugin's `migrate` and `features`. */
export declare function createServerPlugins(plugins: readonly CmsPlugin[], serverConfig: () => Pick<CmsServerConfig, "hooks">, cms: () => Cms): ServerPlugins;

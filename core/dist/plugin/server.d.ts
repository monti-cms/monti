import type { Cms } from "../cms/index.js";
import { type FormatRegistry } from "../format/registry.js";
import type { CmsServerConfig } from "../server/define.js";
import type { EventSubscriber } from "../services/events.js";
import { type HookSource, type PluginScope } from "../services/reactions.js";
import type { OwnedPluginRoute, Plugin, ServerPlugin } from "./define.js";
/** The server side of one plugin: the default export of its loader. `undefined` for a plugin without one. */
export declare function serverSideOf(plugin: Pick<Plugin, "server">): Promise<ServerPlugin | undefined>;
/** The server side of a plugin, with the plugin's name. A plugin without a server side is empty. */
export type LoadedServerPlugin = ServerPlugin & {
    readonly name: string;
};
/**
 * The server side of one site's plugins, owned by one CMS instance (`createCms`): the loaded server modules, the route table, feature flags,
 * migrations, and the `before…` subscribers that run in order (server config first, then plugins).
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
    /** Runs each plugin's migration hook with its scope (its storage is `plugin.storage`). Called after the core tables are created (`monti db:migrate`). */
    migrate(log?: (message: string) => void): Promise<void>;
    /** What a server callback of the named plugin gets: the instance and the plugin's own context. */
    scopeOf(name: string): PluginScope;
    /** Tells the plugin's `on.keySlot.changed` subscribers that a slot of the plugin was assigned or cleared. */
    keySlotChanged(plugin: string, slot: string): Promise<void>;
    /**
     * The checks before the save, one per hook in the order they run: the server config's lists first, then the plugins' in the site config's order.
     * Each is tagged with its owner (`server`, `plugin:<name>`), which a failing hook is reported with.
     */
    writeHooks(): Promise<readonly HookSource[]>;
    /**
     * The subscribers of the committed changes, in the order they are delivered to: the server config's `on.entry` durable subscribers, then each plugin's.
     * The name is `<owner>:<name>` (`server:revalidate`, `plugin:git-sync:sync`) and keys the delivery state of the outbox.
     */
    eventSubscribers(): Promise<readonly EventSubscriber[]>;
}
/** `cms` is the instance that owns these plugins. The plugins' callbacks get it with their own context (`{ cms, plugin }`). */
export declare function createServerPlugins(plugins: readonly Plugin[], serverConfig: () => Pick<CmsServerConfig, "on">, cms: () => Cms): ServerPlugins;

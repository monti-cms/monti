import type { ContentChange } from "../adapters/postgres/store/after-commit.js";
import type { CmsServerPlugin, OwnedPluginRoute, PluginDatabase } from "./define.js";
export declare function loadServerPlugins(): Promise<readonly (CmsServerPlugin & {
    readonly name: string;
})[]>;
/** Plugin API route table (in plugin order, tagged with the plugin each route belongs to). */
export declare function pluginRoutes(): Promise<readonly OwnedPluginRoute[]>;
/** DB connection used by plugins. */
export declare const getCmsDatabase: () => PluginDatabase;
/** Creates the plugin tables. Called after the core tables are created (`monti migrate`). */
export declare function migratePlugins(): Promise<void>;
/**
 * Collects the feature flags plugins add to the meta API under each plugin's name (`{ ai: { ... } }`).
 * Plugins with no feature flags, or that fail, are left out.
 */
export declare function pluginFeatures(): Promise<Record<string, Readonly<Record<string, boolean>>>>;
/** Calls the server config's and the plugins' after-save notifications in turn (the rest are still called if one fails). */
export declare function notifyAfterCommit(change: ContentChange): Promise<void>;

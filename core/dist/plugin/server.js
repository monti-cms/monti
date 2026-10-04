import { cmsConfig } from "../config/resolved.js";
import { cmsServerConfig } from "../server/resolved.js";
/** Plugins of the site config. A config without plugins has an empty tuple type, so it is widened for reading. */
const PLUGINS = cmsConfig.plugins ?? [];
/**
 * Loads the server side of the site config's plugins. Read once on the first call and reused afterwards.
 * A plugin without a server side is empty. If loading fails, it is not remembered so the next call retries, and the error is rethrown as is.
 */
let loaded;
export function loadServerPlugins() {
    loaded ??= Promise.all(PLUGINS.map(async (plugin) => ({ name: plugin.name, ...(await plugin.server?.())?.default }))).catch((error) => {
        loaded = undefined;
        console.error("[cms] failed to load plugin server modules", error);
        throw error;
    });
    return loaded;
}
/** Plugin API route table (in plugin order, tagged with the plugin each route belongs to). */
export async function pluginRoutes() {
    return (await loadServerPlugins()).flatMap((plugin) => (plugin.routes ?? []).map((route) => ({ ...route, plugin: plugin.name })));
}
/** DB connection used by plugins. */
export const getCmsDatabase = () => cmsServerConfig.database.pluginDatabase();
/** Creates the plugin tables. Called after the core tables are created (`monti migrate`). */
export async function migratePlugins() {
    for (const plugin of await loadServerPlugins()) {
        if (!plugin.migrate)
            continue;
        console.log(`Migrating plugin "${plugin.name}"...`);
        await plugin.migrate(getCmsDatabase());
    }
}
/**
 * Collects the feature flags plugins add to the meta API under each plugin's name (`{ ai: { ... } }`).
 * Plugins with no feature flags, or that fail, are left out.
 */
export async function pluginFeatures() {
    const plugins = await loadServerPlugins();
    const entries = await Promise.all(plugins.map(async (plugin) => {
        if (!plugin.features)
            return undefined;
        try {
            return [plugin.name, await plugin.features()];
        }
        catch {
            return undefined;
        }
    }));
    return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}
/** Calls the server config's and the plugins' after-save notifications in turn (the rest are still called if one fails). */
export async function notifyAfterCommit(change) {
    const serverConfig = cmsServerConfig;
    const hooks = [serverConfig.afterCommit, ...(await loadServerPlugins()).map((plugin) => plugin.afterCommit)];
    for (const hook of hooks) {
        if (!hook)
            continue;
        try {
            await hook(change);
        }
        catch (error) {
            console.error("[cms] afterCommit failed", change.kind, change.entryId, error);
        }
    }
}

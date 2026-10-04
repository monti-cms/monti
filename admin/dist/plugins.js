import { assertPluginPagesFree } from "@monti-cms/core";
import { cmsConfig } from "@monti-cms/core/client";
/** Creates an admin plugin (only type-checks). */
export const defineAdminPlugin = (plugin) => plugin;
/** The site config's plugins. A config without plugins has an empty tuple type, so it is widened when read. */
const PLUGINS = cmsConfig.plugins ?? [];
let loaded;
/**
 * Loads the admin side of the site config's plugins. On success it is read once and reused.
 * If loading fails or a screen path collides with the core or another plugin, nothing is remembered so the next call retries, and the error is thrown as is.
 */
export function loadAdminPlugins() {
    loaded ??= Promise.all(PLUGINS.map(async (plugin) => ({
        name: plugin.name,
        ...(await plugin.admin?.())?.default,
    })))
        .then((plugins) => {
        assertPluginPagesFree(plugins.flatMap((plugin) => Object.keys(plugin.pages ?? {}).map((path) => ({ plugin: plugin.name, path }))));
        return plugins;
    })
        .catch((error) => {
        loaded = undefined;
        console.error("[@monti-cms/admin] failed to load admin plugins", error);
        throw error;
    });
    return loaded;
}

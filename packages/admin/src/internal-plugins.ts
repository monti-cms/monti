import type { Site } from "@monti-cms/core/site";
import type { AdminPlugin } from "./plugins";

/** Internal to the Monti packages (`@monti-cms/admin/internal/plugins`), with no stability promise: the host loads the admin side of a site's plugins with it. */

/**
 * One plugin's admin side as the host passes it on. `plugin` is the module's default export, kept as it is: the module may be a `"use client"` one, which the
 * server only refers to and must not read, so the browser applies it (`AdminPluginScope`, the tools page).
 */
export interface LoadedAdminPlugin {
	readonly name: string;
	readonly plugin?: AdminPlugin;
}

type LoadedAdminPlugins = Promise<readonly LoadedAdminPlugin[]>;

const loadedBySite = new WeakMap<object, LoadedAdminPlugins>();

/**
 * Loads the admin side of a site's plugins (`site.plugins`, the instance's real site, not the browser's snapshot: the loaders are server code). On success it is
 * read once per site and reused. If loading fails, nothing is remembered so the next call retries, and the error is thrown as is. Page paths are the plugins'
 * `nav` paths, which the site config already checks for collisions.
 */
export function loadAdminPlugins(site: Pick<Site, "plugins">): LoadedAdminPlugins {
	const known = loadedBySite.get(site);
	if (known) return known;
	const loaded: LoadedAdminPlugins = Promise.all(
		site.plugins.map(async (plugin) => ({
			name: plugin.name,
			plugin: (await plugin.admin?.())?.default as AdminPlugin | undefined,
		})),
	).catch((error) => {
		loadedBySite.delete(site);
		console.error("[@monti-cms/admin] failed to load admin plugins", error);
		throw error;
	});
	loadedBySite.set(site, loaded);
	return loaded;
}

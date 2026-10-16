import { assertPluginPagesFree } from "@monti-cms/core/internal/plugins";
import type { Site } from "@monti-cms/core/site";
import type { CmsAdminPlugin } from "./plugins";

/** Internal to the Monti packages (`@monti-cms/admin/internal/plugins`), with no stability promise: the host loads the admin side of a site's plugins with it. */

type LoadedAdminPlugins = Promise<readonly (CmsAdminPlugin & { readonly name: string })[]>;

const loadedBySite = new WeakMap<object, LoadedAdminPlugins>();

/**
 * Loads the admin side of a site's plugins (`site.plugins`, the instance's real site, not the browser's snapshot: the loaders are server code). On success it is
 * read once per site and reused. If loading fails or a screen path collides with the core or another plugin, nothing is remembered so the next call retries,
 * and the error is thrown as is.
 */
export function loadAdminPlugins(site: Pick<Site, "plugins">): LoadedAdminPlugins {
	const known = loadedBySite.get(site);
	if (known) return known;
	const loaded: LoadedAdminPlugins = Promise.all(
		site.plugins.map(async (plugin) => ({
			name: plugin.name,
			...((await plugin.admin?.())?.default as CmsAdminPlugin | undefined),
		})),
	)
		.then((plugins) => {
			assertPluginPagesFree(
				plugins.flatMap((plugin) => Object.keys(plugin.pages ?? {}).map((path) => ({ plugin: plugin.name, path }))),
			);
			return plugins;
		})
		.catch((error) => {
			loadedBySite.delete(site);
			console.error("[@monti-cms/admin] failed to load admin plugins", error);
			throw error;
		});
	loadedBySite.set(site, loaded);
	return loaded;
}

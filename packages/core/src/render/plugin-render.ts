import type { Site } from "../site";
import { perSite } from "../site/per-site";

/**
 * The module a block extension's `render` loader returns. `documentComponents` is the table of the document renderer (`renderDocument`, typed by node, mark and
 * block name).
 */
export interface RenderPluginModule {
	readonly documentComponents?: unknown;
}

/** Loads the public components of a site's plugins once per site (`render` of `definePlugin`). */
export const renderModules = perSite(
	(site: Pick<Site, "plugins">): Promise<RenderPluginModule[]> =>
		Promise.all(
			site.plugins.flatMap((plugin) => (plugin.render ? [plugin.render() as Promise<RenderPluginModule>] : [])),
		),
);

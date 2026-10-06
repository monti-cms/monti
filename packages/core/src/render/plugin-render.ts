import { cmsConfig } from "../config/resolved";
import type { CmsPlugin } from "../plugin/define";

/**
 * The module a block extension's `render` loader returns. `documentComponents` is the table of the document renderer (`renderDocument`, typed by node, mark and
 * block name).
 */
export interface RenderPluginModule {
	readonly documentComponents?: unknown;
}

let loaded: Promise<RenderPluginModule[]> | undefined;

/** Loads the public components of the site's plugins once (`render` of `definePlugin`). */
export const renderModules = (): Promise<RenderPluginModule[]> => {
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	loaded ??= Promise.all(
		plugins.flatMap((plugin) => (plugin.render ? [plugin.render() as Promise<RenderPluginModule>] : [])),
	);
	return loaded;
};

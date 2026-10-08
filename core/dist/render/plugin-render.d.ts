import type { Site } from "../site/index.js";
/**
 * The module a block extension's `render` loader returns. `documentComponents` is the table of the document renderer (`renderDocument`, typed by node, mark and
 * block name).
 */
export interface RenderPluginModule {
    readonly documentComponents?: unknown;
}
/** Loads the public components of a site's plugins once per site (`render` of `definePlugin`). */
export declare const renderModules: (site: Pick<Site, "plugins">) => Promise<RenderPluginModule[]>;

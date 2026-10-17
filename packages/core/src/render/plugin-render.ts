import type { Site } from "../site";
import { perSite } from "../site/per-site";
import type { LooseDocumentComponents } from "./document/types";

/**
 * The public side of a plugin: the components it adds to the document renderer, by block name. The default export of the module its `render` loader returns
 * (`export default defineRender({ blocks: { notice: Notice } })`). Text blocks go in `marks`, the others in `blocks`; `codeTags` are the elements a code block's
 * text effects draw. Each component gets the block's attributes as props and `ctx` (the page's `locale` and the default labels), so a table needs no setup of its own.
 */
export interface RenderPlugin {
	readonly blocks?: LooseDocumentComponents["blocks"];
	readonly marks?: LooseDocumentComponents["marks"];
	readonly codeTags?: LooseDocumentComponents["codeTags"];
}

/** Types the public side of a plugin: `export default defineRender({ blocks: { ... } })` in the module its `render` loads. It returns what it is given. */
export const defineRender = (plugin: RenderPlugin): RenderPlugin => plugin;

/** Loads the public components of a site's plugins once per site (`render` of `definePlugin`). */
export const renderPlugins = perSite(
	(site: Pick<Site, "plugins">): Promise<RenderPlugin[]> =>
		Promise.all(
			site.plugins.flatMap((plugin) => (plugin.render ? [plugin.render().then((module) => module.default)] : [])),
		),
);

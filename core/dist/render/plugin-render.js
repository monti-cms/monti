import { perSite } from "../site/per-site.js";
/** Types the public side of a plugin: `export default defineRender({ blocks: { ... } })` in the module its `render` loads. It returns what it is given. */
export const defineRender = (plugin) => plugin;
/** Loads the public components of a site's plugins once per site (`render` of `definePlugin`). */
export const renderPlugins = perSite((site) => Promise.all(site.plugins.flatMap((plugin) => (plugin.render ? [plugin.render().then((module) => module.default)] : []))));

import { perSite } from "../site/per-site.js";
/** Loads the public components of a site's plugins once per site (`render` of `definePlugin`). */
export const renderModules = perSite((site) => Promise.all(site.plugins.flatMap((plugin) => (plugin.render ? [plugin.render()] : []))));

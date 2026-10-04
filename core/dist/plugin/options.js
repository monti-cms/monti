import { cmsConfig } from "../config/resolved.js";
/**
 * Config values (`options`) of a plugin picked by name from `plugins` in the site config (`cms.config.ts`). Used by both server and browser code.
 * This is the official way for an extension to read its own config. `undefined` if that plugin is not in the config.
 */
export function getPluginOptions(name) {
    // A config without plugins has an empty tuple type, so it is widened for reading.
    const plugins = cmsConfig.plugins ?? [];
    return plugins.find((plugin) => plugin.name === name)?.options;
}

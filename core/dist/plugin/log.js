/**
 * The two ways a plugin speaks outside its own screens, with one prefix: the plugin's name. A message a person reads in a terminal or a log starts with
 * `[name]`; an error a plugin throws for a mistake in its config starts with `name:`.
 */
/** A logger whose lines start with `[plugin]`. */
export const pluginLog = (plugin) => ({
    info: (...parts) => console.info(`[${plugin}]`, ...parts),
    warn: (...parts) => console.warn(`[${plugin}]`, ...parts),
    error: (...parts) => console.error(`[${plugin}]`, ...parts),
});
/** An error for a mistake in how the plugin is set up: `plugin: message`. */
export const pluginError = (plugin, message, options) => new Error(`${plugin}: ${message}`, options);

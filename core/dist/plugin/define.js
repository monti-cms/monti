/**
 * The server side of a plugin, empty. A plugin package's `server.browser.ts` (the `browser` condition of its `exports`) re-exports this as the default, so the
 * browser bundle that reads the site config gets no server code: `export { emptyServerPlugin as default } from "@monti-cms/core";`.
 */
export const emptyServerPlugin = {};
/**
 * Types the server side of a plugin: `export default defineServerPlugin({ routes, on, ... })` in the module that the plugin's `server` loads
 * (`@monti-cms/core/server`). It returns what it is given.
 */
export const defineServerPlugin = (plugin) => plugin;
/**
 * Creates a plugin. A plugin package exports a function (e.g. `ai()`) that returns this value. The type of what it adds (`contributes`)
 * is preserved so the receiving plugin can read it (e.g. AI feature names).
 */
export function definePlugin(plugin) {
    if (!/^[a-z][a-z0-9-]*$/.test(plugin.name))
        throw new Error(`cms plugin: invalid name "${plugin.name}"`);
    return { ...plugin, options: plugin.options ?? {} };
}

/**
 * Creates a plugin. A plugin package exports a function (e.g. `aiPlugin()`) that returns this value. The type of what it adds (`contributes`)
 * is preserved so the receiving plugin can read it (e.g. AI feature names).
 */
export function definePlugin(plugin) {
    if (!/^[a-z][a-z0-9-]*$/.test(plugin.name))
        throw new Error(`cms plugin: invalid name "${plugin.name}"`);
    return plugin;
}

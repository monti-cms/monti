import { configError, pathOf } from "@monti-cms/core";
import { AI_PLUGIN_NAME } from "./name.js";
import { DEFAULT_AI_ACTIONS } from "./presets.js";
const contributionOf = (plugin) => {
    const ai = plugin.contributes?.ai;
    return ai && typeof ai === "object" ? ai : undefined;
};
/** Builds one action from its source (a definition, or a function of the site). */
const build = (source, site) => typeof source === "function" ? source(site) : source;
export function resolveAiActions(config, site, plugins = []) {
    const view = { ...site, sharedKeys: Object.keys(config.shared ?? {}) };
    const sources = new Map(Object.entries(DEFAULT_AI_ACTIONS));
    for (const plugin of plugins) {
        if (plugin.name === AI_PLUGIN_NAME)
            continue;
        for (const [key, source] of Object.entries(contributionOf(plugin)?.actions ?? {})) {
            if (sources.has(key)) {
                throw configError(pathOf("plugins", plugin.name, "contributes", "ai", "actions", key), "duplicate", `adds AI action "${key}", which is already defined`);
            }
            sources.set(key, source);
        }
    }
    for (const [key, source] of Object.entries(config.actions ?? {})) {
        if (source === false) {
            if (!sources.has(key))
                throw configError(pathOf("plugins", "ai", "actions", key), "unknown-action", "turns off an action that does not exist");
            sources.delete(key);
        }
        else
            sources.set(key, source);
    }
    const built = [...sources].flatMap(([key, source]) => {
        const definition = build(source, view);
        return definition ? [[key, definition]] : [];
    });
    const onField = (definition) => (definition.attach ?? []).some((a) => a.slot === "field");
    return Object.fromEntries([
        ...built.filter(([, definition]) => onField(definition)),
        ...built.filter(([, definition]) => !onField(definition)),
    ]);
}
/** Resolves the AI config and returns it together with the shared texts. */
export const resolveAiConfig = (config, site, plugins = []) => ({
    ...(config.shared ? { shared: config.shared } : {}),
    actions: resolveAiActions(config, site, plugins),
});

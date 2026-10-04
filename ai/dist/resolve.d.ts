import type { AiActionDefinition, AiConfig, AiSiteView, ResolvedAiConfig } from "./action.js";
/**
 * Resolves the AI config (`aiPlugin(config)`) into the list of actions to run. Server (running), browser (slots) and config validation (`validate`) use the same result.
 *
 * 1. Default actions (`DEFAULT_AI_ACTIONS`)
 * 2. Actions added by other plugins (`contributes.ai.actions`, in plugin order). A name that already exists is a config error.
 * 3. `actions` in the config: the same name overrides, `false` removes, a new name adds.
 *
 * The factory function looks at the site config to find where to attach. If there is nowhere to attach and it returns `undefined`, the action is not turned on.
 * Order: field actions first, then the order above within them (the order of the admin AI screen).
 */
/** An AI action contribution of a plugin. */
interface PluginLike {
    readonly name: string;
    readonly contributes?: Readonly<Record<string, unknown>>;
}
export declare function resolveAiActions(config: AiConfig, site: Omit<AiSiteView, "sharedKeys">, plugins?: readonly PluginLike[]): Record<string, AiActionDefinition>;
/** Resolves the AI config and returns it together with the shared texts. */
export declare const resolveAiConfig: (config: AiConfig, site: Omit<AiSiteView, "sharedKeys">, plugins?: readonly PluginLike[]) => ResolvedAiConfig;
export {};

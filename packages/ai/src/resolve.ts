import { configError, pathOf } from "@monti-cms/core";
import type {
	AiActionDefinition,
	AiActionSource,
	AiConfig,
	AiContribution,
	AiSiteView,
	ResolvedAiConfig,
} from "./action";
import { AI_PLUGIN_NAME } from "./name";
import { DEFAULT_AI_ACTIONS } from "./presets";

/**
 * Resolves the AI config (`ai(config)`) into the list of actions to run. Server (running), browser (slots) and config validation (`validate`) use the same result.
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

const contributionOf = (plugin: PluginLike): AiContribution | undefined => {
	const ai = plugin.contributes?.ai;
	return ai && typeof ai === "object" ? (ai as AiContribution) : undefined;
};

/** Builds one action from its source (a definition, or a function of the site). */
const build = (source: AiActionSource, site: AiSiteView): AiActionDefinition | undefined =>
	typeof source === "function" ? source(site) : source;

export function resolveAiActions(
	config: AiConfig,
	site: Omit<AiSiteView, "sharedKeys">,
	plugins: readonly PluginLike[] = [],
): Record<string, AiActionDefinition> {
	const view: AiSiteView = { ...site, sharedKeys: Object.keys(config.shared ?? {}) };
	const sources = new Map<string, AiActionSource>(Object.entries(DEFAULT_AI_ACTIONS));
	for (const plugin of plugins) {
		if (plugin.name === AI_PLUGIN_NAME) continue;
		for (const [key, source] of Object.entries(contributionOf(plugin)?.actions ?? {})) {
			if (sources.has(key)) {
				throw configError(
					pathOf("plugins", plugin.name, "contributes", "ai", "actions", key),
					"duplicate",
					`adds AI action "${key}", which is already defined`,
				);
			}
			sources.set(key, source);
		}
	}
	for (const [key, source] of Object.entries(config.actions ?? {})) {
		if (source === false) {
			if (!sources.has(key))
				throw configError(
					pathOf("plugins", "ai", "actions", key),
					"unknown-action",
					"turns off an action that does not exist",
				);
			sources.delete(key);
		} else sources.set(key, source);
	}

	const built = [...sources].flatMap(([key, source]) => {
		const definition = build(source, view);
		return definition ? [[key, definition] as const] : [];
	});
	const onField = (definition: AiActionDefinition) => (definition.attach ?? []).some((a) => a.slot === "field");
	return Object.fromEntries([
		...built.filter(([, definition]) => onField(definition)),
		...built.filter(([, definition]) => !onField(definition)),
	]);
}

/** Resolves the AI config and returns it together with the shared texts. */
export const resolveAiConfig = (
	config: AiConfig,
	site: Omit<AiSiteView, "sharedKeys">,
	plugins: readonly PluginLike[] = [],
): ResolvedAiConfig => ({
	...(config.shared ? { shared: config.shared } : {}),
	actions: resolveAiActions(config, site, plugins),
});

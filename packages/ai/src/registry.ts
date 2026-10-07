import type { CmsPlugin, CollectionsConfig, PluginNamed } from "@monti-cms/core";
import type { AnyCmsConfig, Site } from "@monti-cms/core/client";
import type {
	AiActionDefinition,
	AiActionInput,
	AiActionResult,
	AiAttach,
	AiConfig,
	AiSharedText,
	AiSiteView,
} from "./action";
import type { AiSlot } from "./definition";
import { AI_PLUGIN_NAME } from "./plugin-name";
import type { DEFAULT_AI_ACTIONS } from "./presets";
import { resolveAiActions } from "./resolve";

/**
 * AI actions of one site (`aiPlugin({ actions })`). The names (keys) and the input/result types are read from the config type; the actions to run are resolved from a
 * site (`aiRegistryOf`). Both the server (running) and the browser (calling by slot and name) use them.
 */

type AiPluginOptions<Config extends AnyCmsConfig> = Config extends { readonly plugins?: infer P }
	? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O>
		? O
		: never
	: never;
type ConfigActions<Config extends AnyCmsConfig> = [AiPluginOptions<Config>] extends [{ readonly actions: infer X }]
	? X
	: Record<never, never>;
/** If it is a factory function, its result (the definition). */
type Built<S> = S extends (...args: never[]) => infer D ? NonNullable<D> : S;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;
type ConfigPlugins<Config extends AnyCmsConfig> = Config extends { readonly plugins?: infer P } ? P : never;
/** Actions added by other plugins (`contributes.ai.actions`). */
type ContributedActions<Config extends AnyCmsConfig> = UnionToIntersection<
	ConfigPlugins<Config> extends readonly (infer P)[]
		? P extends { readonly contributes?: { readonly ai?: { readonly actions?: infer A } } }
			? unknown extends A
				? never
				: A
			: never
		: never
>;
/** Name -> definition (excludes default and added actions that the config changed or turned off). */
type Unconfigured<T, Config extends AnyCmsConfig> = {
	[K in keyof T as K extends keyof ConfigActions<Config> ? never : K]: Built<T[K]>;
};
/** Actions whose types are known: default actions + actions added by other plugins + actions listed in the config (turned-off ones excluded). */
type KnownActions<Config extends AnyCmsConfig> = Unconfigured<typeof DEFAULT_AI_ACTIONS, Config> &
	Unconfigured<
		[ContributedActions<Config>] extends [never] ? Record<never, never> : ContributedActions<Config>,
		Config
	> & {
		[K in keyof ConfigActions<Config> as ConfigActions<Config>[K] extends false ? never : K]: Built<
			ConfigActions<Config>[K]
		>;
	};
/** The loose config (`AnyCmsConfig`) knows no action names, so every name is accepted and an input is any input. */
type ActionsOf<Config extends AnyCmsConfig> = AnyCmsConfig extends Config
	? Readonly<Record<string, AiActionDefinition>>
	: KnownActions<Config>;

/**
 * Action names of a site config: `AiActionKey<typeof config>`. For the loose default (a site whose config type is not known) it is `string`.
 */
export type AiActionKey<Config extends AnyCmsConfig = AnyCmsConfig> = keyof ActionsOf<Config> & string;
/** Input to pass when calling an action of the config. */
export type AiActionInputOf<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> = AiActionInput<
	ActionsOf<Config>[K]
>;
/** Result of an action of the config. */
export type AiActionResultOf<
	K extends AiActionKey<Config>,
	Config extends AnyCmsConfig = AnyCmsConfig,
> = AiActionResult<ActionsOf<Config>[K]>;

/** The AI actions and shared texts of one site, resolved from its config. */
export interface AiRegistry {
	/** Actions to run (default actions + actions added by other plugins + actions in the config, `resolveAiActions`). Empty without the AI plugin. */
	readonly actions: Readonly<Record<string, AiActionDefinition>>;
	/** Shared text definitions (defaults). Values edited in the admin screen are applied by the server. */
	readonly shared: Readonly<Record<string, AiSharedText>>;
	readonly sharedKeys: readonly string[];
	/** Site description that goes into the instruction at the start of every action. */
	readonly siteDescription: string;
	/** The definition under the name, `undefined` if the site has no such action. */
	actionDefinition(key: string): AiActionDefinition | undefined;
}

const registries = new WeakMap<object, AiRegistry>();

/** What a function that creates actions (`AiActionFactory`) sees of a site, apart from the shared texts. */
export const aiSiteViewOf = (site: Site): Omit<AiSiteView, "sharedKeys"> => ({
	// The schemas of the site: their labels are read in the admin language when the site is created.
	collections: Object.fromEntries(site.COLLECTIONS.map((name) => [name, site.schemaOf(name)])) as CollectionsConfig,
	blocks: site.BLOCKS,
	locales: site.config.locales,
	createTranslator: site.createTranslator,
});

function createRegistry(site: Site): AiRegistry {
	const aiConfig = site.getPluginOptions<AiConfig>(AI_PLUGIN_NAME);
	// Functions of the config (factories, checks) reach a site made from the browser snapshot as nothing: an action that only a function defines is missing there, and a
	// definition keeps its data (attach points, inputs, labels, check names). The server resolves from the real config.
	const actions: Readonly<Record<string, AiActionDefinition>> = aiConfig
		? resolveAiActions(aiConfig, aiSiteViewOf(site), site.plugins)
		: {};
	const shared: Readonly<Record<string, AiSharedText>> = aiConfig?.shared ?? {};
	return {
		actions,
		shared,
		sharedKeys: Object.keys(shared),
		siteDescription: aiConfig?.siteDescription?.trim() || "website",
		actionDefinition: (key) => (Object.hasOwn(actions, key) ? actions[key] : undefined),
	};
}

/** The AI registry of a site. Built once per site and kept as long as the site lives. */
export function aiRegistryOf(site: Site): AiRegistry {
	let registry = registries.get(site);
	if (!registry) {
		registry = createRegistry(site);
		registries.set(site, registry);
	}
	return registry;
}

/** What a UI slot looks up. A field slot is the field name and collection; others are the target inside the slot. */
export interface AiPlace {
	/** Slot name. UI slot names are open, so AI may receive a name it does not know (no action is attached to that slot). */
	readonly slot: AiSlot | (string & {});
	readonly target?: string;
	readonly collection?: string;
}

/** Whether the action is attached to the slot. */
export function attachedTo(attach: AiAttach, place: AiPlace): boolean {
	if (attach.slot !== place.slot) return false;
	switch (attach.slot) {
		case "field":
			return (
				attach.field === place.target &&
				(!attach.collections || (place.collection !== undefined && attach.collections.includes(place.collection)))
			);
		case "translation":
		case "selection":
		case "insert":
			return true;
		case "block":
			return attach.block === place.target;
		default:
			return attach.target === place.target;
	}
}

import type { CmsPlugin, PluginNamed } from "@monti-cms/core";
import { ADMIN_LANGUAGE, BLOCKS, cmsConfig, getPluginOptions, type ResolvedConfig } from "@monti-cms/core/client";
import type { AiActionDefinition, AiActionInput, AiActionResult, AiAttach, AiConfig, AiSharedText } from "./action";
import type { AiSlot } from "./definition";
import { setMessageContext } from "./i18n";
import { AI_PLUGIN_NAME } from "./plugin-name";
import type { DEFAULT_AI_ACTIONS } from "./presets";
import { resolveAiActions } from "./resolve";

/**
 * AI actions of the site config (`aiPlugin({ actions })`). Extracts action names (keys) and input/result types from the config.
 * Read by both the server (running) and the browser (calling by slot and name).
 */

type AiPluginOptions = ResolvedConfig extends { readonly plugins?: infer P }
	? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O>
		? O
		: never
	: never;
type ConfigActions = [AiPluginOptions] extends [{ readonly actions: infer X }] ? X : Record<never, never>;
/** If it is a factory function, its result (the definition). */
type Built<S> = S extends (...args: never[]) => infer D ? NonNullable<D> : S;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;
type ConfigPlugins = ResolvedConfig extends { readonly plugins?: infer P } ? P : never;
/** Actions added by other plugins (`contributes.ai.actions`). */
type ContributedActions = UnionToIntersection<
	ConfigPlugins extends readonly (infer P)[]
		? P extends { readonly contributes?: { readonly ai?: { readonly actions?: infer A } } }
			? unknown extends A
				? never
				: A
			: never
		: never
>;
/** Name -> definition (excludes default and added actions that the config changed or turned off). */
type Unconfigured<T> = { [K in keyof T as K extends keyof ConfigActions ? never : K]: Built<T[K]> };
/** Actions whose types are known: default actions + actions added by other plugins + actions listed in the config (turned-off ones excluded). */
type KnownActions = Unconfigured<typeof DEFAULT_AI_ACTIONS> &
	Unconfigured<[ContributedActions] extends [never] ? Record<never, never> : ContributedActions> & {
		[K in keyof ConfigActions as ConfigActions[K] extends false ? never : K]: Built<ConfigActions[K]>;
	};

/** Action names in the config. */
export type AiActionKey = keyof KnownActions & string;
/** Input to pass when calling an action. */
export type AiActionInputOf<K extends AiActionKey> = AiActionInput<KnownActions[K]>;
/** Result of an action. */
export type AiActionResultOf<K extends AiActionKey> = AiActionResult<KnownActions[K]>;

/** Config of the AI plugin registered in the site config. `undefined` if not registered. */
// A config without the plugin has an empty tuple type, so it is read widened.
const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
const aiConfig = getPluginOptions<AiConfig>(AI_PLUGIN_NAME);

// Modules read by the config file (presets, validators) cannot read the config, so the UI language is received here. Set it before resolving actions.
setMessageContext({ language: ADMIN_LANGUAGE, overrides: cmsConfig.admin?.messages });

/** Actions to run (default actions + actions added by other plugins + actions in the config, `resolveAiActions`). */
export const AI_ACTIONS: Readonly<Record<string, AiActionDefinition>> = aiConfig
	? resolveAiActions(
			aiConfig,
			{ collections: cmsConfig.collections, blocks: BLOCKS, locales: cmsConfig.locales },
			plugins,
		)
	: {};

/** Shared text definitions (defaults). Values edited in the admin screen are applied by the server. */
export const AI_SHARED: Readonly<Record<string, AiSharedText>> = aiConfig?.shared ?? {};
export const AI_SHARED_KEYS: readonly string[] = Object.keys(AI_SHARED);

/** Site description that goes into the instruction at the start of every action. */
export const AI_SITE_DESCRIPTION = aiConfig?.siteDescription?.trim() || "website";

export const actionDefinition = (key: string): AiActionDefinition | undefined =>
	Object.hasOwn(AI_ACTIONS, key) ? AI_ACTIONS[key] : undefined;

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

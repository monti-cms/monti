import type { CmsPlugin, PluginNamed } from "@monti-cms/core";
import type { AnyCmsConfig, Site } from "@monti-cms/core/client";
import type { AiActionDefinition, AiActionInput, AiActionResult, AiAttach, AiSharedText, AiSiteView } from "./action.js";
import type { AiSlot } from "./definition.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import type { DEFAULT_AI_ACTIONS } from "./presets.js";
/**
 * AI actions of one site (`aiPlugin({ actions })`). The names (keys) and the input/result types are read from the config type; the actions to run are resolved from a
 * site (`aiRegistryOf`). Both the server (running) and the browser (calling by slot and name) use them.
 */
type AiPluginOptions<Config extends AnyCmsConfig> = Config extends {
    readonly plugins?: infer P;
} ? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O> ? O : never : never;
type ConfigActions<Config extends AnyCmsConfig> = [AiPluginOptions<Config>] extends [{
    readonly actions: infer X;
}] ? X : Record<never, never>;
/** If it is a factory function, its result (the definition). */
type Built<S> = S extends (...args: never[]) => infer D ? NonNullable<D> : S;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
type ConfigPlugins<Config extends AnyCmsConfig> = Config extends {
    readonly plugins?: infer P;
} ? P : never;
/** Actions added by other plugins (`contributes.ai.actions`). */
type ContributedActions<Config extends AnyCmsConfig> = UnionToIntersection<ConfigPlugins<Config> extends readonly (infer P)[] ? P extends {
    readonly contributes?: {
        readonly ai?: {
            readonly actions?: infer A;
        };
    };
} ? unknown extends A ? never : A : never : never>;
/** Name -> definition (excludes default and added actions that the config changed or turned off). */
type Unconfigured<T, Config extends AnyCmsConfig> = {
    [K in keyof T as K extends keyof ConfigActions<Config> ? never : K]: Built<T[K]>;
};
/** Actions whose types are known: default actions + actions added by other plugins + actions listed in the config (turned-off ones excluded). */
type KnownActions<Config extends AnyCmsConfig> = Unconfigured<typeof DEFAULT_AI_ACTIONS, Config> & Unconfigured<[
    ContributedActions<Config>
] extends [never] ? Record<never, never> : ContributedActions<Config>, Config> & {
    [K in keyof ConfigActions<Config> as ConfigActions<Config>[K] extends false ? never : K]: Built<ConfigActions<Config>[K]>;
};
/** The loose config (`AnyCmsConfig`) knows no action names, so every name is accepted and an input is any input. */
type ActionsOf<Config extends AnyCmsConfig> = AnyCmsConfig extends Config ? Readonly<Record<string, AiActionDefinition>> : KnownActions<Config>;
/**
 * Action names of a site config: `AiActionKey<typeof config>`. For the loose default (a site whose config type is not known) it is `string`.
 */
export type AiActionKey<Config extends AnyCmsConfig = AnyCmsConfig> = keyof ActionsOf<Config> & string;
/** Input to pass when calling an action of the config. */
export type AiActionInputOf<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> = AiActionInput<ActionsOf<Config>[K]>;
/** Result of an action of the config. */
export type AiActionResultOf<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> = AiActionResult<ActionsOf<Config>[K]>;
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
/** What a function that creates actions (`AiActionFactory`) sees of a site, apart from the shared texts. */
export declare const aiSiteViewOf: (site: Site) => Omit<AiSiteView, "sharedKeys">;
/** The AI registry of a site. Built once per site and kept as long as the site lives. */
export declare function aiRegistryOf(site: Site): AiRegistry;
/** What a UI slot looks up. A field slot is the field name and collection; others are the target inside the slot. */
export interface AiPlace {
    /** Slot name. UI slot names are open, so AI may receive a name it does not know (no action is attached to that slot). */
    readonly slot: AiSlot | (string & {});
    readonly target?: string;
    readonly collection?: string;
}
/** Whether the action is attached to the slot. */
export declare function attachedTo(attach: AiAttach, place: AiPlace): boolean;
export {};

import type { CmsPlugin, PluginNamed } from "@monti-cms/core";
import { type ResolvedConfig } from "@monti-cms/core/client";
import type { AiActionDefinition, AiActionInput, AiActionResult, AiAttach, AiSharedText } from "./action.js";
import type { AiSlot } from "./definition.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import type { DEFAULT_AI_ACTIONS } from "./presets.js";
/**
 * AI actions of the site config (`aiPlugin({ actions })`). Extracts action names (keys) and input/result types from the config.
 * Read by both the server (running) and the browser (calling by slot and name).
 */
type AiPluginOptions = ResolvedConfig extends {
    readonly plugins?: infer P;
} ? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O> ? O : never : never;
type ConfigActions = [AiPluginOptions] extends [{
    readonly actions: infer X;
}] ? X : Record<never, never>;
/** If it is a factory function, its result (the definition). */
type Built<S> = S extends (...args: never[]) => infer D ? NonNullable<D> : S;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
type ConfigPlugins = ResolvedConfig extends {
    readonly plugins?: infer P;
} ? P : never;
/** Actions added by other plugins (`contributes.ai.actions`). */
type ContributedActions = UnionToIntersection<ConfigPlugins extends readonly (infer P)[] ? P extends {
    readonly contributes?: {
        readonly ai?: {
            readonly actions?: infer A;
        };
    };
} ? unknown extends A ? never : A : never : never>;
/** Name -> definition (excludes default and added actions that the config changed or turned off). */
type Unconfigured<T> = {
    [K in keyof T as K extends keyof ConfigActions ? never : K]: Built<T[K]>;
};
/** Actions whose types are known: default actions + actions added by other plugins + actions listed in the config (turned-off ones excluded). */
type KnownActions = Unconfigured<typeof DEFAULT_AI_ACTIONS> & Unconfigured<[ContributedActions] extends [never] ? Record<never, never> : ContributedActions> & {
    [K in keyof ConfigActions as ConfigActions[K] extends false ? never : K]: Built<ConfigActions[K]>;
};
/** Action names in the config. */
export type AiActionKey = keyof KnownActions & string;
/** Input to pass when calling an action. */
export type AiActionInputOf<K extends AiActionKey> = AiActionInput<KnownActions[K]>;
/** Result of an action. */
export type AiActionResultOf<K extends AiActionKey> = AiActionResult<KnownActions[K]>;
/** Actions to run (default actions + actions added by other plugins + actions in the config, `resolveAiActions`). */
export declare const AI_ACTIONS: Readonly<Record<string, AiActionDefinition>>;
/** Shared text definitions (defaults). Values edited in the admin screen are applied by the server. */
export declare const AI_SHARED: Readonly<Record<string, AiSharedText>>;
export declare const AI_SHARED_KEYS: readonly string[];
/** Site description that goes into the instruction at the start of every action. */
export declare const AI_SITE_DESCRIPTION: string;
export declare const actionDefinition: (key: string) => AiActionDefinition | undefined;
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

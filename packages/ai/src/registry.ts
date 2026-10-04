import type { CmsPlugin, PluginNamed } from "@monti-cms/core";
import { ADMIN_LANGUAGE, BLOCKS, cmsConfig, getPluginOptions, type ResolvedConfig } from "@monti-cms/core/client";
import type { AiActionDefinition, AiActionInput, AiActionResult, AiAttach, AiConfig, AiSharedText } from "./action";
import type { AiSlot } from "./definition";
import { setMessageContext } from "./i18n";
import { AI_PLUGIN_NAME } from "./plugin-name";
import type { DEFAULT_AI_ACTIONS } from "./presets";
import { resolveAiActions } from "./resolve";

/**
 * 사이트 설정의 AI 기능(`aiPlugin({ actions })`). 기능 이름(key)과 입력·결과 타입을 설정에서 뽑는다.
 * 서버(실행)와 브라우저(자리·이름으로 부르기)가 함께 읽는다.
 */

type AiPluginOptions = ResolvedConfig extends { readonly plugins?: infer P }
	? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O>
		? O
		: never
	: never;
type ConfigActions = [AiPluginOptions] extends [{ readonly actions: infer X }] ? X : Record<never, never>;
/** 만드는 함수면 그 결과(정의). */
type Built<S> = S extends (...args: never[]) => infer D ? NonNullable<D> : S;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;
type ConfigPlugins = ResolvedConfig extends { readonly plugins?: infer P } ? P : never;
/** 다른 플러그인이 더한 기능(`contributes.ai.actions`). */
type ContributedActions = UnionToIntersection<
	ConfigPlugins extends readonly (infer P)[]
		? P extends { readonly contributes?: { readonly ai?: { readonly actions?: infer A } } }
			? unknown extends A
				? never
				: A
			: never
		: never
>;
/** 이름 → 정의(설정이 바꾸거나 끈 기본·더한 기능은 뺀다). */
type Unconfigured<T> = { [K in keyof T as K extends keyof ConfigActions ? never : K]: Built<T[K]> };
/** 타입을 아는 기능: 기본 기능 + 다른 플러그인이 더한 기능 + 설정에 적은 기능(끈 것은 뺀다). */
type KnownActions = Unconfigured<typeof DEFAULT_AI_ACTIONS> &
	Unconfigured<[ContributedActions] extends [never] ? Record<never, never> : ContributedActions> & {
		[K in keyof ConfigActions as ConfigActions[K] extends false ? never : K]: Built<ConfigActions[K]>;
	};

/** 설정에 있는 기능 이름. */
export type AiActionKey = keyof KnownActions & string;
/** 기능을 부를 때 줄 입력. */
export type AiActionInputOf<K extends AiActionKey> = AiActionInput<KnownActions[K]>;
/** 기능의 결과. */
export type AiActionResultOf<K extends AiActionKey> = AiActionResult<KnownActions[K]>;

/** 사이트 설정에 등록한 AI 플러그인의 설정. 등록하지 않았으면 `undefined`. */
// 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다.
const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
const aiConfig = getPluginOptions<AiConfig>(AI_PLUGIN_NAME);

// 설정 파일이 읽는 모듈(프리셋·검사)은 설정을 읽을 수 없어 화면 언어를 여기서 받는다. 기능을 풀기 전에 넣는다.
setMessageContext({ language: ADMIN_LANGUAGE, overrides: cmsConfig.admin?.messages });

/** 실행할 기능(기본 기능 + 다른 플러그인이 더한 기능 + 설정의 기능, `resolveAiActions`). */
export const AI_ACTIONS: Readonly<Record<string, AiActionDefinition>> = aiConfig
	? resolveAiActions(
			aiConfig,
			{ collections: cmsConfig.collections, blocks: BLOCKS, locales: cmsConfig.locales },
			plugins,
		)
	: {};

/** 공통 문구 정의(기본값). 관리자 화면에서 고친 값은 서버가 얹는다. */
export const AI_SHARED: Readonly<Record<string, AiSharedText>> = aiConfig?.shared ?? {};
export const AI_SHARED_KEYS: readonly string[] = Object.keys(AI_SHARED);

/** 모든 기능 맨 앞 지시에 들어가는 사이트 소개. */
export const AI_SITE_DESCRIPTION = aiConfig?.siteDescription?.trim() || "website";

export const actionDefinition = (key: string): AiActionDefinition | undefined =>
	Object.hasOwn(AI_ACTIONS, key) ? AI_ACTIONS[key] : undefined;

/** 화면 자리가 찾는 곳. 필드 자리는 필드 이름과 컬렉션, 나머지는 자리 안 대상이다. */
export interface AiPlace {
	/** 자리 이름. 화면 자리 이름은 열려 있어서 AI가 모르는 이름도 올 수 있다(그 자리에는 붙지 않는다). */
	readonly slot: AiSlot | (string & {});
	readonly target?: string;
	readonly collection?: string;
}

/** 자리에 붙은 기능인가. */
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

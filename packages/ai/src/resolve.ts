import type {
	AiActionDefinition,
	AiActionSource,
	AiConfig,
	AiContribution,
	AiSiteView,
	ResolvedAiConfig,
} from "./action";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { DEFAULT_AI_ACTIONS } from "./presets";

/**
 * AI 설정(`aiPlugin(config)`)을 실행할 기능 목록으로 푼다. 서버(실행)·브라우저(자리)·설정 검사(`validate`)가 같은 결과를 쓴다.
 *
 * 1. 기본 기능(`DEFAULT_AI_ACTIONS`)
 * 2. 다른 플러그인이 더한 기능(`contributes.ai.actions`, 플러그인 순서). 이미 있는 이름이면 설정 오류다.
 * 3. 설정의 `actions`: 같은 이름이면 바꾸고, `false`면 빼고, 새 이름이면 더한다.
 *
 * 만드는 함수는 사이트 설정을 보고 붙을 곳을 찾는다. 붙을 곳이 없어 `undefined`면 그 기능은 켜지지 않는다.
 * 순서는 필드 옆 기능이 먼저이고, 그 안에서는 위 순서다(관리자 AI 화면의 순서).
 */

/** 플러그인의 AI 기능 기여. */
interface PluginLike {
	readonly name: string;
	readonly contributes?: Readonly<Record<string, unknown>>;
}

const contributionOf = (plugin: PluginLike): AiContribution | undefined => {
	const ai = plugin.contributes?.ai;
	return ai && typeof ai === "object" ? (ai as AiContribution) : undefined;
};

/** 설정 이름(`cms.config: …`)과 함께 기능을 만든다. */
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
				throw new Error(`cms.config: plugins.${plugin.name} adds AI action "${key}", which is already defined`);
			}
			sources.set(key, source);
		}
	}
	for (const [key, source] of Object.entries(config.actions ?? {})) {
		if (source === false) {
			if (!sources.has(key)) throw new Error(`cms.config: ai.actions.${key} turns off an action that does not exist`);
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

/** AI 설정을 풀어 공통 문구와 함께 돌려준다. */
export const resolveAiConfig = (
	config: AiConfig,
	site: Omit<AiSiteView, "sharedKeys">,
	plugins: readonly PluginLike[] = [],
): ResolvedAiConfig => ({
	...(config.shared ? { shared: config.shared } : {}),
	actions: resolveAiActions(config, site, plugins),
});

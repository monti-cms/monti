import { definePlugin } from "@monti-cms/core";
import { type AiConfig, validateAiConfig } from "./action";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { resolveAiConfig } from "./resolve";

/**
 * AI 플러그인. 사이트 설정(`cms.config.ts`)의 `plugins`에 한 번 적으면 AI 기능(이름으로 부르기·필드 옆 버튼·
 * 번역)과 관리자 AI 화면, AI API(`/api/cms/v1/ai/*`), AI 표가 생긴다.
 *
 * 기본 기능(`aiPresets`)은 붙을 곳이 있으면 저절로 켜지고, 다른 플러그인(블록 확장·SEO 확장 등)이 더한 기능도 저절로 붙는다.
 * 바꾸거나 끌 것만 `actions`에 적는다.
 *
 * ```ts
 * plugins: [aiPlugin({ siteDescription: "개인 기술 블로그", actions: { draft: false } })]
 * ```
 */
export function aiPlugin<const Config extends AiConfig>(config: Config = {} as Config) {
	return definePlugin({
		name: AI_PLUGIN_NAME,
		options: config,
		nav: [{ path: "ai", label: "AI", icon: "sparkles" }],
		validate: ({ collections, blocks, blockDefinitions, locales, plugins }) =>
			validateAiConfig(
				resolveAiConfig(config, { collections, blocks: blockDefinitions, locales }, plugins),
				collections,
				blocks,
			),
		// 브라우저 묶음에서는 `./server`가 빈 진입점(`server.browser.ts`)으로 바뀐다(package.json `exports`).
		server: () => import("@monti-cms/ai/server"),
		admin: () => import("@monti-cms/ai/admin"),
	});
}

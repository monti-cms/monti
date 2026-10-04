import { defineConfig } from "@monti-cms/core";
import { callout, chart, collapsible, columns, mermaid, tabs } from "../../blocks/src";
import { ALL_BLOCKS } from "../../blocks/src/definitions";
import base from "../../core/test/cms.config";
import { seo } from "../../seo/src";
import { aiPlugin } from "../src";

/**
 * 본체 패키지의 예시 블로그 설정에 이 블로그와 같은 플러그인(블록 확장·SEO 확장·AI)을 더한 설정. AI 플러그인 테스트가 쓴다.
 * AI 기능은 블로그처럼 적지 않는다: 기본 기능과 블록·SEO 확장이 더한 기능이 저절로 켜진다.
 */
export default defineConfig({
	...base,
	// 블록 확장의 블록은 플러그인이 더한다(블록 AI 기능이 함께 붙는다). 남는 것은 예시 사용자 블록이다.
	blocks: (base.blocks ?? []).filter((block) => !(ALL_BLOCKS as readonly unknown[]).includes(block)),
	plugins: [
		callout(),
		collapsible(),
		tabs(),
		columns(),
		mermaid(),
		chart(),
		seo(),
		aiPlugin({
			siteDescription: "개인 기술 블로그",
			shared: {
				styleGuide: { label: "문체 가이드", text: "" },
			},
		}),
	],
});

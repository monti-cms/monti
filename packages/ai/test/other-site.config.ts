import { defineConfig } from "@monti-cms/core";
import { chart } from "../../blocks/src";
import { chartBlock } from "../../blocks/src/definitions";
import base from "../../core/test/other-site.config";
import { seo } from "../../seo/src";
import { aiPlugin, aiPresets } from "../src";

/**
 * 본체 패키지의 다른 사이트 설정(article·topic·author, 영어)에 블록 확장(차트)·SEO 확장·AI 플러그인을 더한 설정. 필드 기능은
 * 이름을 적지 않아도 이 사이트의 필드(`excerpt`·`topicIds`·`authorId`·`metaTitle`…)에 종류·역할·관계 대상으로 붙는다.
 * 타입 검사(`tsconfig.other-site.json`)와 AI 플러그인 테스트의 다른 사이트 묶음(`vitest.othersite.config.ts`)이 쓴다.
 */
export default defineConfig({
	...base,
	blocks: (base.blocks ?? []).filter((block) => block !== chartBlock),
	plugins: [
		chart(),
		seo(),
		aiPlugin({
			siteDescription: "Example site",
			actions: {
				// 끄기와 바꾸기: 미디어 화면 캡션 추천은 끄고, 요약은 짧게.
				imageCaption: false,
				summary: aiPresets.summary({ maxLength: 200 }),
			},
		}),
	],
});

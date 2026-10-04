import { definePlugin } from "@monti-cms/core";
import { seoAiContribution } from "./ai";
import { validateSeoFields } from "./validate";

export const SEO_PLUGIN_NAME = "seo";

export interface SeoPluginOptions {
	/** AI 플러그인이 있으면 검색 제목·설명 추천을 더한다. 기본 `true`. */
	readonly ai?: boolean;
}

/**
 * SEO 확장. 사이트 설정의 `plugins`에 넣는다. 필드는 컬렉션에 `seoFields()`로 펼쳐 넣는다.
 *
 * - 관리자 화면: 검색 결과·공유 미리보기(보기 필드 `search`), 검색 제목·설명 글자 수와 비었을 때 쓸 값 안내, 숨기기 스위치
 * - 설정 검사: SEO 역할이 맞는 종류의 필드에 붙었는지
 * - AI 플러그인이 있으면 검색 제목·설명 추천(`seoTitle`·`seoDescription`)
 *
 * ```ts
 * plugins: [seo(), aiPlugin()]
 * ```
 */
export const seo = (options: SeoPluginOptions = {}) =>
	definePlugin({
		name: SEO_PLUGIN_NAME,
		options,
		validate: validateSeoFields,
		admin: () => import("@monti-cms/seo/admin"),
		...(options.ai === false ? {} : { contributes: { ai: seoAiContribution } }),
	});

/**
 * SEO 확장(`@monti-cms/seo`). 사이트 설정 파일(`cms.config.ts`)과 공개 화면이 import한다. 서버·브라우저가 함께 읽으므로
 * 관리자 화면 코드·비밀 값을 넣지 않는다(관리자 쪽은 `@monti-cms/seo/admin`).
 */
export { seoAi, seoAiContribution } from "./ai";
export {
	SEO_DEFAULT_KEYS,
	SEO_DEFAULT_LABELS,
	SEO_DEFAULT_LIMITS,
	SEO_INPUTS,
	SEO_PREVIEW_VIEW,
	SEO_ROLES,
	type SeoFields,
	type SeoFieldsOptions,
	type SeoPart,
	seoFields,
} from "./fields";
export { SEO_PLUGIN_NAME, type SeoPluginOptions, seo } from "./plugin";
export { type SeoValues, seoOf } from "./read";
export { validateSeoFields } from "./validate";

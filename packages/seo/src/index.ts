/**
 * The SEO plugin's server half (`@monti-cms/seo`): what `monti.config.ts` and the site's pages import. It holds no admin UI; that is
 * `@monti-cms/seo/admin`.
 */
export {
	SEO_FIELDS,
	SEO_FOLLOWS,
	SEO_INPUTS,
	SEO_LIMITS,
	SEO_PREVIEW,
	type SeoFollows,
	type SeoOptions,
	seo,
} from "./fields";
export { type SeoValues, seoOf } from "./read";

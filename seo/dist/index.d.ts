/**
 * SEO extension (`@monti-cms/seo`). Imported by the site config file (`cms.config.ts`) and public pages. Read by both server and browser, so
 * it must not contain admin UI code or secrets (the admin side is `@monti-cms/seo/admin`).
 */
export { seoAi, seoAiContribution } from "./ai.js";
export { SEO_DEFAULT_KEYS, SEO_DEFAULT_LABELS, SEO_DEFAULT_LIMITS, SEO_INPUTS, SEO_PREVIEW_VIEW, SEO_ROLES, type SeoFields, type SeoFieldsOptions, type SeoPart, seoFields, } from "./fields.js";
export { SEO_PLUGIN_NAME, type SeoPluginOptions, seo } from "./plugin.js";
export { type SeoValues, seoOf } from "./read.js";
export { validateSeoFields } from "./validate.js";

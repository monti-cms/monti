import { definePlugin } from "@monti-cms/core";
import { seoAiContribution } from "./ai";
import { validateSeoFields } from "./validate";

export const SEO_PLUGIN_NAME = "seo";

export interface SeoPluginOptions {
	/** Adds search title and description suggestions when the AI plugin is present. Default `true`. */
	readonly ai?: boolean;
}

/**
 * SEO extension. Add it to the site config `plugins`. Spread the fields into a collection with `seoFields()`.
 *
 * - Admin UI: search result and share preview (view field `search`), character counts for search title and description with a hint for the fallback value, and a hide switch
 * - Config validation: SEO roles are attached to fields of the right kind
 * - With the AI plugin, search title and description suggestions (`seoTitle`, `seoDescription`)
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

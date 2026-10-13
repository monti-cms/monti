import { definePlugin, type PluginPlacement } from "@monti-cms/core";
import { seoAiContribution } from "./ai";
import { SEO_PREVIEW_VIEW, SEO_ROLES } from "./fields";
import { SEO_PLUGIN_NAME } from "./name";
import { checkSeoFields } from "./validate";

export { SEO_PLUGIN_NAME } from "./name";

export interface SeoPluginOptions {
	/** Adds search title and description suggestions when the AI plugin is present. Default `true`. */
	readonly ai?: boolean;
	/** Name of the tab of the edit screen's properties panel the SEO fields are placed in (1 to 20 characters). Default `SEO`. */
	readonly tab?: string;
}

/**
 * SEO extension. Add it to the site config `plugins`. Spread the fields into a collection with `seoFields()`; the plugin places them in their own tab (`tab`, default `SEO`)
 * of the properties panel.
 *
 * - Admin UI: search result and share preview (view field `search`), character counts for search title and description with a hint for the fallback value, and a hide switch
 * - Config validation: SEO roles are attached to fields of the right kind
 * - With the AI plugin, search title and description suggestions (`seoTitle`, `seoDescription`)
 *
 * ```ts
 * plugins: [seo(), ai()]
 * ```
 */
export const seo = (options: SeoPluginOptions = {}) => {
	// The fields `seoFields()` makes are found by role and by the preview's view name, so a site that renames them keeps the tab.
	const layout: readonly PluginPlacement[] = [
		{ tab: options.tab ?? "SEO", roles: Object.values(SEO_ROLES), views: [SEO_PREVIEW_VIEW] },
	];
	return definePlugin({
		name: SEO_PLUGIN_NAME,
		options,
		validate: checkSeoFields,
		admin: () => import("@monti-cms/seo/admin"),
		contributes: { layout, ...(options.ai === false ? {} : { ai: seoAiContribution }) },
	});
};

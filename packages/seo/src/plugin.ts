import { definePlugin, type PluginFieldSet, type PluginPlacement } from "@monti-cms/core";
import { seoAiContribution } from "./ai";
import { SEO_ROLES, seoFields } from "./fields";
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
 * SEO extension. Add it to the site config `plugins`. Add the fields with the "Add SEO fields" action on the Fields tab of the settings screen (they are written into
 * `monti.schema.ts` as plain fields), or spread `seoFields()` into a collection defined in code; the plugin places them in their own tab (`tab`, default `SEO`) of the
 * properties panel.
 *
 * - Admin UI: the SEO tab as a read list: an empty title, description or image says what it follows ("same as the title"), with a character count while the title or description is edited
 * - Config validation: SEO roles are attached to fields of the right kind
 * - With the AI plugin, search title and description suggestions (`seoTitle`, `seoDescription`)
 *
 * ```ts
 * plugins: [seo(), ai()]
 * ```
 */
export const seo = (options: SeoPluginOptions = {}) => {
	// The fields `seoFields()` makes are found by role, so a site that renames them keeps the tab.
	const layout: readonly PluginPlacement[] = [{ tab: options.tab ?? "SEO", roles: Object.values(SEO_ROLES) }];
	// The field set the schema screen adds to a collection ("Add SEO fields"): the same fields `seoFields()` makes, as plain data for the schema file.
	const fieldSets: readonly PluginFieldSet[] = [
		{ id: "seo", label: options.tab ?? "SEO", roles: Object.values(SEO_ROLES), fields: seoFields() },
	];
	return definePlugin({
		name: SEO_PLUGIN_NAME,
		options,
		checkConfig: checkSeoFields,
		admin: () => import("@monti-cms/seo/admin"),
		contributes: { layout, fieldSets, ...(options.ai === false ? {} : { ai: seoAiContribution }) },
	});
};

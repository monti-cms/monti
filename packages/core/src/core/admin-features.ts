import type { CmsConfig } from "../config/define";

/** What the admin of one site offers, as far as the site config decides it. */
export type SiteAdminFeatures = ReturnType<typeof createAdminFeatures>;

/** The admin features of a site config (`admin.templates`, `admin.translations` and the number of locales). */
export function createAdminFeatures(config: Pick<CmsConfig, "admin" | "locales">) {
	/** Whether the admin offers body templates (`admin.templates`, default `true`): the editor's template menu, the sidebar link and the Templates screen. */
	const ADMIN_TEMPLATES: boolean = config.admin?.templates !== false;

	/**
	 * Whether the admin shows the translation UI: the language tabs of the editor, the locale column, filter and badges of the list. Never on a site with one locale;
	 * on a site with several, unless `admin.translations` is `false`.
	 */
	const ADMIN_TRANSLATIONS: boolean = config.locales.length > 1 && config.admin?.translations !== false;

	return { ADMIN_TEMPLATES, ADMIN_TRANSLATIONS };
}

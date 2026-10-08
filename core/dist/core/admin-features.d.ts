import type { CmsConfig } from "../config/define.js";
/** What the admin of one site offers, as far as the site config decides it. */
export type SiteAdminFeatures = ReturnType<typeof createAdminFeatures>;
/** The admin features of a site config (`admin.templates`, `admin.translations` and the number of locales). */
export declare function createAdminFeatures(config: Pick<CmsConfig, "admin" | "locales">): {
    ADMIN_TEMPLATES: boolean;
    ADMIN_TRANSLATIONS: boolean;
};

import { type CmsConfig, DEFAULT_ADMIN_PATH } from "../config/define.js";
export { DEFAULT_ADMIN_PATH };
export { adminHrefWith, CMS_API_PATH, cmsApiUrl, cmsBasePath, normalizeBasePath, withBasePath } from "./base-path.js";
/** The admin addresses of one site. */
export type SiteAdminPaths = ReturnType<typeof createAdminPaths>;
/** The admin address rules of a site config (`admin.path` and `site.home`). */
export declare function createAdminPaths(config: Pick<CmsConfig, "admin" | "site">): {
    ADMIN_PATH: string;
    adminHref: (path?: string) => string;
    adminUrl: (path?: string) => string;
    adminEntryEditHref: (id: string) => string;
    SITE_HOME: string;
};

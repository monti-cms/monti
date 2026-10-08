import { DEFAULT_ADMIN_PATH } from "../config/define.js";
import { adminHrefWith, withBasePath } from "./base-path.js";
export { DEFAULT_ADMIN_PATH };
export { adminHrefWith, CMS_API_PATH, cmsApiUrl, cmsBasePath, normalizeBasePath, withBasePath } from "./base-path.js";
/** The admin address rules of a site config (`admin.path` and `site.home`). */
export function createAdminPaths(config) {
    /** Admin screen path (`admin.path`, default `/admin`). Must match the app's admin route folder. */
    const ADMIN_PATH = config.admin?.path ?? DEFAULT_ADMIN_PATH;
    /**
     * Address inside the admin screen. `adminHref()` is the list (`/admin`), `adminHref("/media")` is `/admin/media`,
     * and `adminHref("?collection=post")` is `/admin?collection=post`. The path follows `admin.path`.
     * Same basis as Next's `Link`, `router`, `redirect()` and `usePathname()`, so there is no `basePath`. Use `adminUrl()` when you need a browser address.
     */
    const adminHref = (path = "") => adminHrefWith(ADMIN_PATH, path);
    /** `adminHref()` plus `basePath`: a browser address (for `window.open`, `history`, login `redirectTo` and the session sign-in page). */
    const adminUrl = (path = "") => withBasePath(adminHref(path));
    /** Address of the entry edit screen inside the admin. */
    const adminEntryEditHref = (id) => adminHref(`/entries/${id}/edit`);
    /** Address of the admin sidebar "View site" link (`site.home`, default `/`). */
    const SITE_HOME = config.site?.home ?? "/";
    return { ADMIN_PATH, adminHref, adminUrl, adminEntryEditHref, SITE_HOME };
}

import { DEFAULT_ADMIN_PATH } from "../config/define";
import { cmsConfig } from "../config/resolved";
import { adminHrefWith, withBasePath } from "./base-path";

export { DEFAULT_ADMIN_PATH };
export { adminHrefWith, CMS_API_PATH, cmsApiUrl, cmsBasePath, normalizeBasePath, withBasePath } from "./base-path";

/** Admin screen path (`admin.path`, default `/admin`). Must match the app's admin route folder. */
export const ADMIN_PATH: string = cmsConfig.admin?.path ?? DEFAULT_ADMIN_PATH;

/**
 * Address inside the admin screen. `adminHref()` is the list (`/admin`), `adminHref("/media")` is `/admin/media`,
 * and `adminHref("?collection=post")` is `/admin?collection=post`. The path follows `admin.path`.
 * Same basis as Next's `Link`, `router`, `redirect()` and `usePathname()`, so there is no `basePath`. Use `adminUrl()` when you need a browser address.
 */
export const adminHref = (path = ""): string => adminHrefWith(ADMIN_PATH, path);

/** `adminHref()` plus `basePath`: a browser address (for `window.open`, `history`, login `redirectTo` and the session sign-in page). */
export const adminUrl = (path = ""): string => withBasePath(adminHref(path));

/** Address of the post edit screen inside the admin. */
export const adminEntryEditHref = (id: string): string => adminHref(`/entries/${id}/edit`);

/** Address of the admin sidebar "View site" link (`site.home`, default `/`). */
export const SITE_HOME: string = cmsConfig.site?.home ?? "/";

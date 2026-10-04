import { DEFAULT_ADMIN_PATH } from "../config/define.js";
export { DEFAULT_ADMIN_PATH };
export { adminHrefWith, CMS_API_PATH, cmsApiUrl, cmsBasePath, normalizeBasePath, withBasePath } from "./base-path.js";
/** Admin screen path (`admin.path`, default `/admin`). Must match the app's admin route folder. */
export declare const ADMIN_PATH: string;
/**
 * Address inside the admin screen. `adminHref()` is the list (`/admin`), `adminHref("/media")` is `/admin/media`,
 * and `adminHref("?collection=post")` is `/admin?collection=post`. The path follows `admin.path`.
 * Same basis as Next's `Link`, `router`, `redirect()` and `usePathname()`, so there is no `basePath`. Use `adminUrl()` when you need a browser address.
 */
export declare const adminHref: (path?: string) => string;
/** `adminHref()` plus `basePath`: a browser address (for `window.open`, `history`, login `redirectTo` and the session sign-in page). */
export declare const adminUrl: (path?: string) => string;
/** Address of the post edit screen inside the admin. */
export declare const adminEntryEditHref: (id: string) => string;
/** Address of the admin sidebar "View site" link (`site.home`, default `/`). */
export declare const SITE_HOME: string;

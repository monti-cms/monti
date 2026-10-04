import { ADMIN_LOCALE, CMS_TIME_ZONE } from "@monti-cms/core/client";
/** Date/time display of the admin screen. Notation follows the admin screen language (`admin.locale`), time zone follows the site setting (`timeZone`). */
export const formatDateTime = (value, options = {}) => new Date(value).toLocaleString(ADMIN_LOCALE, { timeZone: CMS_TIME_ZONE, ...options });
/** Date only (`2025. 8. 7.`). */
export const formatDateOnly = (value) => new Date(value).toLocaleDateString(ADMIN_LOCALE, { timeZone: CMS_TIME_ZONE });
/** Year in the configured time zone. */
export const zonedYear = (value) => Number(new Date(value).toLocaleString("en-US", { timeZone: CMS_TIME_ZONE, year: "numeric" }));

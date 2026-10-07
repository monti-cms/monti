import type { Site } from "@monti-cms/core/client";

/** Date/time display of the admin screen. Notation follows the admin screen language (`admin.locale`), time zone follows the site setting (`timeZone`). */
export const formatDateTime = (site: Site, value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
	new Date(value).toLocaleString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE, ...options });

/** Date only (`2025. 8. 7.`). */
export const formatDateOnly = (site: Site, value: string | number | Date) =>
	new Date(value).toLocaleDateString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE });

/** Year in the configured time zone. */
export const zonedYear = (site: Site, value: string | number | Date) =>
	Number(new Date(value).toLocaleString("en-US", { timeZone: site.CMS_TIME_ZONE, year: "numeric" }));

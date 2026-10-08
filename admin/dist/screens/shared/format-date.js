/** Date/time display of the admin screen. Notation follows the admin screen language (`admin.locale`), time zone follows the site setting (`timeZone`). */
export const formatDateTime = (site, value, options = {}) => new Date(value).toLocaleString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE, ...options });
/** Date only (`2025. 8. 7.`). */
export const formatDateOnly = (site, value) => new Date(value).toLocaleDateString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE });
/** Year in the configured time zone. */
export const zonedYear = (site, value) => Number(new Date(value).toLocaleString("en-US", { timeZone: site.CMS_TIME_ZONE, year: "numeric" }));

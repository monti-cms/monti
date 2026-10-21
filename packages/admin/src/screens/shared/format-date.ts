import type { Site } from "@monti-cms/core/site";

/** Date/time display of the admin screen. Notation follows the admin screen language (`admin.locale`), time zone follows the site setting (`timeZone`). */
export const formatDateTime = (site: Site, value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
	new Date(value).toLocaleString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE, ...options });

/** Date only (`2025. 8. 7.`). */
export const formatDateOnly = (site: Site, value: string | number | Date) =>
	new Date(value).toLocaleDateString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE });

/** Year in the configured time zone. */
export const zonedYear = (site: Site, value: string | number | Date) =>
	Number(new Date(value).toLocaleString("en-US", { timeZone: site.CMS_TIME_ZONE, year: "numeric" }));

/** How long ago, in the admin language and in short form ("2 min. ago"). Under a minute it reads "now". */
export const formatAgo = (site: Site, value: string | number | Date, now: number = Date.now()) => {
	const seconds = Math.round((new Date(value).getTime() - now) / 1000);
	const format = new Intl.RelativeTimeFormat(site.ADMIN_LOCALE, { numeric: "auto", style: "short" });
	if (Math.abs(seconds) < 60) return format.format(0, "second");
	const minutes = Math.round(seconds / 60);
	if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return format.format(hours, "hour");
	return format.format(Math.round(hours / 24), "day");
};

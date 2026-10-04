/**
 * Time zone rules for date-time input (`datetime-local`). Input is the wall clock in the site config's `timeZone` and is stored as a UTC instant.
 */
export declare const CMS_TIME_ZONE: string;
/**
 * Language for date and number formatting in the admin screen (BCP 47). The site config's `admin.locale`, or if absent the site's default locale (same as the screen text).
 */
export declare const ADMIN_LOCALE: string;
/** Converts a UTC instant to a `datetime-local` string (`YYYY-MM-DDTHH:mm`) in that time zone. */
export declare function formatDateTimeInput(value: string | number | Date | null | undefined, timeZone?: string): string;
/**
 * Converts a wall-clock input in that time zone to a UTC ISO instant. A date that does not exist (e.g. Feb 30) or a time that does not exist in that time zone (skipped
 * by daylight saving time) gives `null`.
 */
export declare function parseDateTimeInput(value: string, timeZone?: string): string | null;

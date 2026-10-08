import type { CmsConfig } from "../config/define.js";
/** Converts a UTC instant to a `datetime-local` string (`YYYY-MM-DDTHH:mm`) in that time zone. */
export declare function formatDateTimeInput(value: string | number | Date | null | undefined, timeZone: string): string;
/**
 * Converts a wall-clock input in that time zone to a UTC ISO instant. A date that does not exist (e.g. Feb 30) or a time that does not exist in that time zone (skipped
 * by daylight saving time) gives `null`.
 */
export declare function parseDateTimeInput(value: string, timeZone: string): string | null;
/** The time zone and the formatting language of one site. */
export type SiteTime = ReturnType<typeof createTime>;
/** The time rules of a site config (`timeZone`, `admin.locale`): the date-time input helpers already set to the site's time zone. */
export declare function createTime(config: Pick<CmsConfig, "timeZone" | "admin" | "defaultLocale">): {
    CMS_TIME_ZONE: string;
    ADMIN_LOCALE: string;
    /** `formatDateTimeInput` in the site's time zone (or the one given). */
    formatDateTimeInput: (value: string | number | Date | null | undefined, timeZone?: string) => string;
    /** `parseDateTimeInput` in the site's time zone (or the one given). */
    parseDateTimeInput: (value: string, timeZone?: string) => string | null;
};

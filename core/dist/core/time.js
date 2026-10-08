function zonedParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const part = (type) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}
const pad = (value, length = 2) => String(value).padStart(length, "0");
/** Converts a UTC instant to a `datetime-local` string (`YYYY-MM-DDTHH:mm`) in that time zone. */
export function formatDateTimeInput(value, timeZone) {
    if (value === null || value === undefined || value === "")
        return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "";
    const { year, month, day, hour, minute } = zonedParts(date, timeZone);
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
/** The difference from UTC (minutes) at this instant in that time zone. */
function offsetMinutes(instant, timeZone) {
    const { year, month, day, hour, minute } = zonedParts(new Date(instant), timeZone);
    const asUtc = Date.UTC(year, month - 1, day, hour, minute);
    return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}
/**
 * Converts a wall-clock input in that time zone to a UTC ISO instant. A date that does not exist (e.g. Feb 30) or a time that does not exist in that time zone (skipped
 * by daylight saving time) gives `null`.
 */
export function parseDateTimeInput(value, timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match)
        return null;
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    const wall = new Date(0);
    wall.setUTCFullYear(year, month - 1, day);
    wall.setUTCHours(hour, minute, 0, 0);
    if (wall.getUTCFullYear() !== year ||
        wall.getUTCMonth() !== month - 1 ||
        wall.getUTCDate() !== day ||
        wall.getUTCHours() !== hour ||
        wall.getUTCMinutes() !== minute) {
        return null;
    }
    // Take the value as if the wall clock were UTC, subtract the time zone offset, and adjust once more at a DST boundary.
    let instant = wall.getTime() - offsetMinutes(wall.getTime(), timeZone) * 60_000;
    instant = wall.getTime() - offsetMinutes(instant, timeZone) * 60_000;
    return formatDateTimeInput(instant, timeZone) === value ? new Date(instant).toISOString() : null;
}
/** The time rules of a site config (`timeZone`, `admin.locale`): the date-time input helpers already set to the site's time zone. */
export function createTime(config) {
    /** The site config's `timeZone` (IANA), `UTC` if unset. Dates and times are entered and shown in it. */
    const CMS_TIME_ZONE = config.timeZone ?? "UTC";
    /**
     * Language for date and number formatting in the admin screen (BCP 47). The site config's `admin.locale`, or if absent the site's default locale (same as the screen text).
     */
    const ADMIN_LOCALE = config.admin?.locale ?? config.defaultLocale;
    return {
        CMS_TIME_ZONE,
        ADMIN_LOCALE,
        /** `formatDateTimeInput` in the site's time zone (or the one given). */
        formatDateTimeInput: (value, timeZone = CMS_TIME_ZONE) => formatDateTimeInput(value, timeZone),
        /** `parseDateTimeInput` in the site's time zone (or the one given). */
        parseDateTimeInput: (value, timeZone = CMS_TIME_ZONE) => parseDateTimeInput(value, timeZone),
    };
}

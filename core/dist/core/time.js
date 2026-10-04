import { cmsConfig } from "../config/resolved.js";
/**
 * Time zone rules for date-time input (`datetime-local`). Input is the wall clock in the site config's `timeZone` and is stored as a UTC instant.
 */
export const CMS_TIME_ZONE = cmsConfig.timeZone ?? "UTC";
/**
 * Language for date and number formatting in the admin screen (BCP 47). The site config's `admin.locale`, or if absent the site's default locale (same as the screen text).
 */
export const ADMIN_LOCALE = cmsConfig.admin?.locale ?? cmsConfig.defaultLocale;
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
export function formatDateTimeInput(value, timeZone = CMS_TIME_ZONE) {
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
export function parseDateTimeInput(value, timeZone = CMS_TIME_ZONE) {
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

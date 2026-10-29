import type { Site } from "@monti-cms/core/site";
import type { TranslatorFor } from "../../translator";
import { formatDateTime } from "../shared/format-date";
import type { entryCompareMessages } from "./entry-compare.messages";

/** The time of day of a moment, 24-hour ("10:41"), in the site's time zone. */
export const clockTime = (site: Site, value: string | number | Date): string =>
	formatDateTime(site, value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A moment as month, day and time ("10. 26 10:12"), in the site's time zone; the order and the marks between them are the language's. */
export function stampOf(
	site: Site,
	t: TranslatorFor<typeof entryCompareMessages>,
	value: string | number | Date,
): string {
	const parts = new Intl.DateTimeFormat(site.ADMIN_LOCALE, {
		timeZone: site.CMS_TIME_ZONE,
		month: "numeric",
		day: "numeric",
	}).formatToParts(new Date(value));
	const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
	return t("stamp", { month: part("month"), day: part("day"), time: clockTime(site, value) });
}

/** A day as year, month and day ("2026. 10. 01"), in the site's time zone. */
export const shortDate = (site: Site, value: string | number | Date): string =>
	formatDateTime(site, value, { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.$/, "");

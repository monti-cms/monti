import type { Site } from "@monti-cms/core/site";

const partsOf = (site: Pick<Site, "ADMIN_LOCALE" | "CMS_TIME_ZONE">, value: Date | string) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: site.CMS_TIME_ZONE,
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(new Date(value));
	const part = (type: "year" | "month" | "day") => Number(parts.find((candidate) => candidate.type === type)?.value);
	return { year: part("year"), month: part("month"), day: part("day") };
};

/** The date of a row as the list shows it: month and day ("10. 26") within this year, with the year ("25. 08. 07") before it. `—` where there is none. */
export function shortDate(
	site: Pick<Site, "ADMIN_LOCALE" | "CMS_TIME_ZONE">,
	value: Date | string | null,
	now: Date = new Date(),
): string {
	if (!value) return "—";
	const { year, month, day } = partsOf(site, value);
	const pad = (n: number) => String(n).padStart(2, "0");
	return year === partsOf(site, now).year
		? `${pad(month)}. ${pad(day)}`
		: `${pad(year % 100)}. ${pad(month)}. ${pad(day)}`;
}

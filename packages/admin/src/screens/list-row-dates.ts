import type { ListEntriesItem, ListSortField, Site } from "@monti-cms/core/site";

/** The dates an order can group the rows by. A title or an address order has no months to group by. */
const DATE_SORTS = ["updatedAt", "createdAt", "publishedAt"] as const;
type DateSort = (typeof DATE_SORTS)[number];

const isDateSort = (field: ListSortField): field is DateSort => (DATE_SORTS as readonly string[]).includes(field);

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

/**
 * The month mark of each row of a list ordered by a date: the name of the month ("Oct" in English) on the first row of each month, and nothing on the rows after it.
 * The month is the one the row's ordered date falls in, in the site's time zone. A row without that date (a draft has no published date) has no mark and does not
 * end a month. Ordered by title or address there are no months, so no row has a mark.
 */
export function monthMarks(
	site: Pick<Site, "ADMIN_LOCALE" | "CMS_TIME_ZONE">,
	items: readonly Pick<ListEntriesItem, "updatedAt" | "createdAt" | "publishedAt">[],
	sortField: ListSortField,
): (string | null)[] {
	if (!isDateSort(sortField)) return items.map(() => null);
	let previous: string | null = null;
	return items.map((item) => {
		const value = item[sortField];
		if (!value) return null;
		const { year, month } = partsOf(site, value);
		const key = `${year}-${month}`;
		if (key === previous) return null;
		previous = key;
		return new Date(value).toLocaleDateString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE, month: "short" });
	});
}

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

/** A day given as `YYYY-MM-DD` as the list says a date: "10. 05" within this year, "25. 10. 05" before it. */
export function shortDay(
	site: Pick<Site, "ADMIN_LOCALE" | "CMS_TIME_ZONE">,
	day: string,
	now: Date = new Date(),
): string {
	const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
	const pad = (n: number) => String(n).padStart(2, "0");
	return year === partsOf(site, now).year
		? `${pad(month)}. ${pad(date)}`
		: `${pad(year % 100)}. ${pad(month)}. ${pad(date)}`;
}

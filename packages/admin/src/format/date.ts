// Every date and time the admin writes comes from here, in the admin's language, so the same moment reads the same on every screen. `check:design`
// (`format-only`) keeps `Intl.DateTimeFormat` and hand-built dates out of the screens.

const two = (value: number) => String(value).padStart(2, "0");

/** A clock time, "10:41". */
export const clock = (value: Date | string) => {
	const date = new Date(value);
	return `${two(date.getHours())}:${two(date.getMinutes())}`;
};

/** A day in a list or a line: "10. 26" this year, "25. 08. 03" in another (list.md: the column is as wide as the short one). */
export function shortDate(value: Date | string | null, language: string, now = new Date()): string {
	if (value === null) return "";
	const date = new Date(value);
	const thisYear = date.getFullYear() === now.getFullYear();
	if (language === "ko") {
		const day = `${two(date.getMonth() + 1)}. ${two(date.getDate())}`;
		return thisYear ? day : `${two(date.getFullYear() % 100)}. ${day}`;
	}
	return new Intl.DateTimeFormat(language, {
		...(thisYear ? {} : { year: "2-digit" }),
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

/** A moment in a list or a line: the short day, then the hour and minute ("10. 26 10:58", "25. 08. 03 10:58"). */
export function shortTime(value: Date | string, language: string, now = new Date()): string {
	return `${shortDate(value, language, now)} ${clock(value)}`;
}

/** A moment in a conversation: the hour today ("10:58"), the short day and the hour before ("10. 24 10:58"). */
export function recentTime(value: Date | string, language: string, now = new Date()): string {
	return new Date(value).toDateString() === now.toDateString() ? clock(value) : shortTime(value, language, now);
}

/** When something last happened, where a day is enough: the hour today ("10:58"), the short day before ("10. 24"). */
export function recentDay(value: Date | string, language: string, now = new Date()): string {
	return new Date(value).toDateString() === now.toDateString() ? clock(value) : shortDate(value, language, now);
}

/** A whole day, year and all: "2026. 10. 01" in Korean, the language's own date otherwise. */
export function fullDate(value: Date | string, language: string): string {
	const date = new Date(value);
	if (language === "ko") return `${date.getFullYear()}. ${two(date.getMonth() + 1)}. ${two(date.getDate())}`;
	return new Intl.DateTimeFormat(language, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

/** A whole moment, what a short date's tooltip says: "2026. 11. 14 16:54". */
export function fullTime(value: Date | string, language: string): string {
	return `${fullDate(value, language)} ${clock(value)}`;
}

/** A day as a filter and the server write it: "2026-10-26", in the person's own time. */
export const isoDay = (date: Date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;

/** The person's time zone, which the server counts days in. */
export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

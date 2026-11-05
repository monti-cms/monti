const two = (value: number) => String(value).padStart(2, "0");

/** A clock time, "10:41". */
export const clock = (date: Date) => `${two(date.getHours())}:${two(date.getMinutes())}`;

/** A day as the reference screens write it: "2026. 10. 01" in Korean, the language's own short date otherwise. */
export function day(date: Date, language: string) {
	if (language === "ko") return `${date.getFullYear()}. ${two(date.getMonth() + 1)}. ${two(date.getDate())}`;
	return new Intl.DateTimeFormat(language, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

/** A day and a time in this year: "10. 26 10:12". */
export function dayTime(date: Date, language: string) {
	if (language === "ko") return `${two(date.getMonth() + 1)}. ${two(date.getDate())} ${clock(date)}`;
	return `${new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(date)} ${clock(date)}`;
}

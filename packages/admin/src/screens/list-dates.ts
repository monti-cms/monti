import type { Site } from "@monti-cms/core/site";

/** The presets of the date filter, each a run of whole days that ends today. */
export const DATE_PRESETS = ["today", "last7", "last30"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

const PRESET_DAYS: Record<DatePreset, number> = { today: 1, last7: 7, last30: 30 };

/** A date filter: a preset, which keeps meaning "today" whenever it is read, or a fixed range of days (`YYYY-MM-DD`, both ends included). */
export type DateFilter =
	| { readonly kind: "preset"; readonly preset: DatePreset }
	| { readonly kind: "range"; readonly from: string; readonly to: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `value` is a day that exists on the calendar. */
const isDay = (value: string): boolean => {
	const match = DAY.exec(value);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Reads `today`, `last7`, `last30` or `from..to` (the address of a date filter). Anything else, and a range that ends before it starts, is no filter. */
export function parseDateFilter(raw: string | null): DateFilter | null {
	if (raw === null) return null;
	const preset = DATE_PRESETS.find((candidate) => candidate === raw);
	if (preset) return { kind: "preset", preset };
	const [from = "", to = "", ...rest] = raw.split("..");
	if (rest.length > 0 || !isDay(from) || !isDay(to) || from > to) return null;
	return { kind: "range", from, to };
}

export const writeDateFilter = (filter: DateFilter): string =>
	filter.kind === "preset" ? filter.preset : `${filter.from}..${filter.to}`;

const shiftDay = (day: string, days: number): string => {
	const [year, month, date] = day.split("-").map(Number) as [number, number, number];
	return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
};

/** The days a filter covers, `YYYY-MM-DD` at both ends. A preset counts back from today by the site's calendar (`now` is passed so a test can fix it). */
export function dateRangeOf(site: Pick<Site, "formatDateTimeInput">, filter: DateFilter, now: Date = new Date()) {
	if (filter.kind === "range") return { from: filter.from, to: filter.to };
	const today = site.formatDateTimeInput(now).slice(0, 10);
	return { from: shiftDay(today, 1 - PRESET_DAYS[filter.preset]), to: today };
}

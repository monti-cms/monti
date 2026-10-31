import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { dateRangeOf, parseDateFilter, writeDateFilter } from "../list-dates";

const NOW = new Date("2026-10-28T03:00:00Z"); // 12:00 on 28 October in Seoul

describe("date filters of the list", () => {
	it("LIST-F4 reads a preset or a range from the address, and writes it back as it was", () => {
		for (const raw of ["today", "last7", "last30", "2026-03-01..2026-03-05", "2026-03-01..2026-03-01"]) {
			const filter = parseDateFilter(raw);
			expect(filter, raw).not.toBeNull();
			expect(writeDateFilter(filter as NonNullable<typeof filter>)).toBe(raw);
		}
	});

	it("LIST-F4 reads nothing from what is not a filter", () => {
		for (const raw of [
			null,
			"",
			"yesterday",
			"last 7",
			"2026-03-05..2026-03-01",
			"2026-02-30..2026-03-01",
			"2026-03-01",
			"2026-03-01..",
			"..2026-03-01",
		]) {
			expect(parseDateFilter(raw), String(raw)).toBeNull();
		}
	});

	it("LIST-F4 takes today, the last 7 days and the last 30 days as whole days ending today in the site's time zone", () => {
		expect(dateRangeOf(testSite, { kind: "preset", preset: "today" }, NOW)).toEqual({
			from: "2026-10-28",
			to: "2026-10-28",
		});
		expect(dateRangeOf(testSite, { kind: "preset", preset: "last7" }, NOW)).toEqual({
			from: "2026-10-22",
			to: "2026-10-28",
		});
		expect(dateRangeOf(testSite, { kind: "preset", preset: "last30" }, NOW)).toEqual({
			from: "2026-09-29",
			to: "2026-10-28",
		});
	});

	it("LIST-F4 counts today by the site's calendar, not UTC's", () => {
		// 16:00 UTC on the 27th is already the 28th in Seoul.
		expect(dateRangeOf(testSite, { kind: "preset", preset: "today" }, new Date("2026-10-27T16:00:00Z"))).toEqual({
			from: "2026-10-28",
			to: "2026-10-28",
		});
	});

	it("LIST-F4 crosses month and year ends", () => {
		expect(dateRangeOf(testSite, { kind: "preset", preset: "last7" }, new Date("2027-01-03T03:00:00Z")).from).toBe(
			"2026-12-28",
		);
	});

	it("LIST-F4 gives a range as it is", () => {
		expect(dateRangeOf(testSite, { kind: "range", from: "2026-03-01", to: "2026-03-05" }, NOW)).toEqual({
			from: "2026-03-01",
			to: "2026-03-05",
		});
	});
});

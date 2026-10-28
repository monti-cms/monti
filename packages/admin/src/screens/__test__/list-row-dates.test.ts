import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { monthMarks, shortDate } from "../list-row-dates";

const day = (iso: string) => new Date(`${iso}T03:00:00Z`);
const row = (updatedAt: string, extra: { publishedAt?: string | null; createdAt?: string } = {}) => ({
	updatedAt: day(updatedAt),
	createdAt: day(extra.createdAt ?? updatedAt),
	publishedAt: extra.publishedAt === undefined ? null : extra.publishedAt === null ? null : day(extra.publishedAt),
});

describe("the month marks of the rows", () => {
	const rows = [
		row("2026-10-26"),
		row("2026-10-25"),
		row("2026-10-01"),
		row("2026-09-20"),
		row("2026-09-02"),
		row("2026-08-28"),
	];

	it("name the month on the first row of each month and leave the rows after it empty", () => {
		expect(monthMarks(testSite, rows, "updatedAt")).toEqual(["10월", null, null, "9월", null, "8월"]);
	});

	it("follow the date the list is ordered by", () => {
		const published = [
			row("2026-10-26", { publishedAt: "2026-07-01" }),
			row("2026-10-25", { publishedAt: "2026-07-01" }),
		];
		expect(monthMarks(testSite, published, "publishedAt")).toEqual(["7월", null]);
		expect(monthMarks(testSite, published, "createdAt")).toEqual(["10월", null]);
	});

	it("are none when the list is ordered by title or address, which have no months", () => {
		expect(monthMarks(testSite, rows, "title")).toEqual(rows.map(() => null));
		expect(monthMarks(testSite, rows, "slug")).toEqual(rows.map(() => null));
	});

	it("skip a row that has no such date without ending its month", () => {
		const mixed = [
			row("2026-10-26", { publishedAt: "2026-10-20" }),
			row("2026-10-25", { publishedAt: null }),
			row("2026-10-24", { publishedAt: "2026-10-02" }),
		];
		expect(monthMarks(testSite, mixed, "publishedAt")).toEqual(["10월", null, null]);
	});

	it("count the month in the site's time zone, not UTC's", () => {
		// 16:00 UTC on 31 October is 1 November in Seoul.
		const late = [{ ...row("2026-10-31"), updatedAt: new Date("2026-10-31T16:00:00Z") }, row("2026-10-30")];
		expect(monthMarks(testSite, late, "updatedAt")).toEqual(["11월", "10월"]);
	});
});

describe("the short date of a row", () => {
	const now = new Date("2026-10-28T03:00:00Z");

	it("is month and day within this year", () => {
		expect(shortDate(testSite, day("2026-10-26"), now)).toBe("10. 26");
		expect(shortDate(testSite, day("2026-01-05"), now)).toBe("01. 05");
	});

	it("carries the year before this one", () => {
		expect(shortDate(testSite, day("2025-08-07"), now)).toBe("25. 08. 07");
	});

	it("is a dash where there is no date", () => {
		expect(shortDate(testSite, null, now)).toBe("—");
	});
});

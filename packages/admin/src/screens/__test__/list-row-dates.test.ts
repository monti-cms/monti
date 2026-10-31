import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { shortDate } from "../list-row-dates";

const day = (iso: string) => new Date(`${iso}T03:00:00Z`);
const _row = (updatedAt: string, extra: { publishedAt?: string | null; createdAt?: string } = {}) => ({
	updatedAt: day(updatedAt),
	createdAt: day(extra.createdAt ?? updatedAt),
	publishedAt: extra.publishedAt === undefined ? null : extra.publishedAt === null ? null : day(extra.publishedAt),
});

describe("the short date of a row", () => {
	const now = new Date("2026-10-28T03:00:00Z");

	it("LIST-S3 is month and day within this year", () => {
		expect(shortDate(testSite, day("2026-10-26"), now)).toBe("10. 26");
		expect(shortDate(testSite, day("2026-01-05"), now)).toBe("01. 05");
	});

	it("LIST-S3 carries the year before this one", () => {
		expect(shortDate(testSite, day("2025-08-07"), now)).toBe("25. 08. 07");
	});

	it("LIST-S3 is a dash where there is no date", () => {
		expect(shortDate(testSite, null, now)).toBe("—");
	});
});

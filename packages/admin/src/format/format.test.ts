import { describe, expect, it } from "vitest";
import { bytes } from "./bytes";
import { clock, fullDate, fullTime, isoDay, recentDay, recentTime, shortDate, shortTime } from "./date";
import { extensionLabel, fieldName, titleOf } from "./names";

const now = new Date(2026, 10, 16, 9, 0);
const words: Record<string, string> = {
	"list.untitled": "제목 없음",
	"list.column.title": "제목",
	"settings.field.kind.slug": "주소",
};
const t = (key: unknown) => words[String(key)] ?? String(key);

describe("dates as every screen writes them", () => {
	it("[MN-14] a short date has its year when it is not this year's", () => {
		expect(shortDate(new Date(2026, 9, 26), "ko", now)).toBe("10. 26");
		expect(shortDate(new Date(2025, 9, 26), "ko", now)).toBe("25. 10. 26");
		expect(shortDate(null, "ko", now)).toBe("");
	});

	it("[MN-14] a short moment has its year too: the compare view and the editor's notice", () => {
		expect(shortTime(new Date(2026, 9, 26, 10, 12), "ko", now)).toBe("10. 26 10:12");
		expect(shortTime(new Date(2025, 9, 26, 10, 12), "ko", now)).toBe("25. 10. 26 10:12");
	});

	it("[TC-03] the full moment, a short date's tooltip, has the year and the time", () => {
		expect(fullTime(new Date(2026, 10, 14, 16, 54), "ko")).toBe("2026. 11. 14 16:54");
		expect(fullDate(new Date(2026, 10, 4), "ko")).toBe("2026. 11. 04");
	});

	it("[ST-37] a recent moment is the hour today and the short day before, with the year of another year", () => {
		expect(recentDay(new Date(2026, 10, 16, 8, 5), "ko", now)).toBe("08:05");
		expect(recentDay(new Date(2026, 10, 15, 8, 5), "ko", now)).toBe("11. 15");
		expect(recentDay(new Date(2025, 10, 15, 8, 5), "ko", now)).toBe("25. 11. 15");
		expect(recentTime(new Date(2026, 10, 16, 8, 5), "ko", now)).toBe("08:05");
		expect(recentTime(new Date(2025, 10, 15, 8, 5), "ko", now)).toBe("25. 11. 15 08:05");
	});

	it("[MN-14] another language writes the same parts its own way, the year only when it is another year", () => {
		expect(shortDate(new Date(2026, 9, 26), "en", now)).toBe("10/26");
		expect(shortDate(new Date(2025, 9, 26), "en", now)).toBe("10/26/25");
		expect(fullDate(new Date(2026, 9, 1), "en")).toBe("Oct 1, 2026");
	});

	it("a clock and a filter's day", () => {
		expect(clock(new Date(2026, 0, 1, 7, 3))).toBe("07:03");
		expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
	});
});

describe("a file's size", () => {
	it("[MD-18] no bytes: under a kilobyte reads 1 KB, kilobytes whole, megabytes with one decimal", () => {
		expect(bytes(0)).toBe("1 KB");
		expect(bytes(12)).toBe("1 KB");
		expect(bytes(340 * 1024)).toBe("340 KB");
		expect(bytes(1_288_490)).toBe("1.2 MB");
		expect(bytes(14 * 1024 * 1024)).toBe("14.0 MB");
	});
});

describe("names", () => {
	it("[LR-15] an empty title is the list's word, never an id", () => {
		expect(titleOf("", t)).toBe("제목 없음");
		expect(titleOf("  ", t)).toBe("제목 없음");
		expect(titleOf(null, t)).toBe("제목 없음");
		expect(titleOf("글", t)).toBe("글");
	});

	it("[AT-08] a field is called by its fixed word, then its label, then its id", () => {
		expect(fieldName("title", undefined, t)).toBe("제목");
		expect(fieldName("slug", "slug", t)).toBe("주소");
		expect(fieldName("summary", "요약", t)).toBe("요약");
		expect(fieldName("summary", undefined, t)).toBe("summary");
	});

	it("09-1 a file with no picture says what it is by its name", () => {
		expect(extensionLabel("price-list-2026.pdf")).toBe("PDF");
		expect(extensionLabel("noextension")).toBe("");
	});
});

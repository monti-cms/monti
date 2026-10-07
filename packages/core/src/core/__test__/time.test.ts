import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import { formatDateTimeInput, parseDateTimeInput } from "../time";

describe("time zone of date-time input", () => {
	it("takes input as wall clock in the configured time zone and stores UTC", () => {
		// The config's time zone (UTC if absent) is the default. Time zone calculation passes the name directly so it is checked regardless of the config.
		expect(testSite.CMS_TIME_ZONE).toBe(testConfig.timeZone ?? "UTC");
		expect(testSite.parseDateTimeInput("2026-02-13T00:21")).toBe(
			parseDateTimeInput("2026-02-13T00:21", testSite.CMS_TIME_ZONE),
		);
		expect(testSite.formatDateTimeInput(testSite.parseDateTimeInput("2026-02-13T00:21"))).toBe("2026-02-13T00:21");
		expect(parseDateTimeInput("2026-02-13T00:21", "Asia/Seoul")).toBe("2026-02-12T15:21:00.000Z");
		expect(formatDateTimeInput("2026-02-12T15:21:00.000Z", "Asia/Seoul")).toBe("2026-02-13T00:21");
		expect(testSite.formatDateTimeInput(null)).toBe("");
		expect(testSite.formatDateTimeInput("not a date")).toBe("");
	});

	it("rejects nonexistent dates and bad formats", () => {
		expect(testSite.parseDateTimeInput("2026-02-30T10:00")).toBeNull();
		expect(testSite.parseDateTimeInput("2026-02-13 00:21")).toBeNull();
	});

	it("round-trips in time zones with daylight saving time and rejects skipped times", () => {
		expect(parseDateTimeInput("2026-07-01T12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
		expect(parseDateTimeInput("2026-01-15T12:00", "America/New_York")).toBe("2026-01-15T17:00:00.000Z");
		expect(parseDateTimeInput("2026-03-08T02:30", "America/New_York")).toBeNull();
		expect(formatDateTimeInput("2026-07-01T16:00:00.000Z", "America/New_York")).toBe("2026-07-01T12:00");
	});
});

import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import { formatDateTimeInput, parseDateTimeInput } from "../time";

describe("time zone of date-time input", () => {
	it("LIST-F4 takes input as wall clock in the configured time zone and stores UTC", () => {
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
});

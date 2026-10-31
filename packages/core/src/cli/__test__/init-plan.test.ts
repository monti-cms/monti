import { describe, expect, it } from "vitest";
import { timeZoneNote } from "../init-plan";

describe("the time zone line of the summary", () => {
	it("INIT-Q4 names the zone, where it came from and what to change", () => {
		const fromComputer = timeZoneNote({ timeZone: "Asia/Seoul", timeZoneSource: "computer" }, "src/monti.schema.ts");
		expect(fromComputer).toContain("Asia/Seoul");
		expect(fromComputer).toContain("this computer");
		expect(fromComputer).toContain("`timeZone` in src/monti.schema.ts");

		const fromFlag = timeZoneNote({ timeZone: "Asia/Tokyo", timeZoneSource: "flag" }, "monti.schema.ts");
		expect(fromFlag).toContain("Asia/Tokyo");
		expect(fromFlag).toContain("--time-zone");
		expect(fromFlag).toContain("`timeZone` in monti.schema.ts");

		const fallback = timeZoneNote({ timeZone: "UTC", timeZoneSource: "fallback" }, "monti.schema.ts");
		expect(fallback).toContain("UTC");
		expect(fallback).toContain("could not be read");
		expect(fallback).toContain("`timeZone` in monti.schema.ts");
	});
});

import { describe, expect, it } from "vitest";
import { cmsConfig } from "../../config/resolved";
import { CMS_TIME_ZONE, formatDateTimeInput, parseDateTimeInput } from "../time";

describe("날짜·시각 입력의 시간대", () => {
	it("설정의 시간대 벽시계로 입력하고 UTC로 저장한다", () => {
		// 설정의 시간대(없으면 UTC)가 기본값이다. 시간대 계산은 이름을 직접 넘겨 설정과 상관없이 확인한다.
		expect(CMS_TIME_ZONE).toBe(cmsConfig.timeZone ?? "UTC");
		expect(parseDateTimeInput("2026-02-13T00:21")).toBe(parseDateTimeInput("2026-02-13T00:21", CMS_TIME_ZONE));
		expect(formatDateTimeInput(parseDateTimeInput("2026-02-13T00:21"))).toBe("2026-02-13T00:21");
		expect(parseDateTimeInput("2026-02-13T00:21", "Asia/Seoul")).toBe("2026-02-12T15:21:00.000Z");
		expect(formatDateTimeInput("2026-02-12T15:21:00.000Z", "Asia/Seoul")).toBe("2026-02-13T00:21");
		expect(formatDateTimeInput(null)).toBe("");
		expect(formatDateTimeInput("not a date")).toBe("");
	});

	it("없는 날짜·형식은 받지 않는다", () => {
		expect(parseDateTimeInput("2026-02-30T10:00")).toBeNull();
		expect(parseDateTimeInput("2026-02-13 00:21")).toBeNull();
	});

	it("서머타임이 있는 시간대도 왕복하고, 건너뛴 시각은 받지 않는다", () => {
		expect(parseDateTimeInput("2026-07-01T12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
		expect(parseDateTimeInput("2026-01-15T12:00", "America/New_York")).toBe("2026-01-15T17:00:00.000Z");
		expect(parseDateTimeInput("2026-03-08T02:30", "America/New_York")).toBeNull();
		expect(formatDateTimeInput("2026-07-01T16:00:00.000Z", "America/New_York")).toBe("2026-07-01T12:00");
	});
});

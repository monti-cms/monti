// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkWithBareun } from "../api";
import { resolveBareunOptions } from "../options";

// 실제 바른 API를 부른다(요금이 든다). `BAREUN_LIVE_TEST=1`이고 키(`BAREUN_API_KEY`)가 있을 때만 돈다.
const live = process.env.BAREUN_LIVE_TEST === "1";

describe.runIf(live)("바른 실제 호출", () => {
	it("짧은 문장의 틀린 곳을 문단 안 위치로 돌려준다", async () => {
		const apiKey = process.env.BAREUN_API_KEY?.trim();
		expect(apiKey, "BAREUN_API_KEY가 없습니다").toBeTruthy();
		const options = resolveBareunOptions();
		const text = "학교에 갔읍니다.";
		const issues = await checkWithBareun([{ id: "a", text, locale: "ko" }], {
			apiKey: apiKey ?? "",
			baseUrl: options.baseUrl,
			customDictNames: [],
			signal: AbortSignal.timeout(20_000),
		});
		const issue = issues.find((item) => text.slice(item.start, item.end).includes("읍니다"));
		expect(issue).toBeDefined();
		expect(issue?.suggestions.some((suggestion) => suggestion.includes("습니다"))).toBe(true);
	});
});

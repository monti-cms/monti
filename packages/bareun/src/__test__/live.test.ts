// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkWithBareun } from "../api";
import { resolveBareunOptions } from "../options";

// Calls the real Bareun API (billed). Runs only when `BAREUN_LIVE_TEST=1` and a key (`BAREUN_API_KEY`) is set.
const live = process.env.BAREUN_LIVE_TEST === "1";

describe.runIf(live)("Bareun live call", () => {
	it("returns the errors of a short sentence as in-paragraph positions", async () => {
		const apiKey = process.env.BAREUN_API_KEY?.trim();
		expect(apiKey, "BAREUN_API_KEY is not set").toBeTruthy();
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

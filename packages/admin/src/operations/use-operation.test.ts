import { coreMessages, formatMessage } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { reasonOf } from "./use-operation";

describe("reasonOf", () => {
	it("a refusal with no reason says that something went wrong and nothing after it, in both languages", () => {
		const words = reasonOf({ status: 500, error: "unexpected", reason: null });
		expect(formatMessage([coreMessages], "ko", words)).toBe("문제가 생겼습니다");
		expect(formatMessage([coreMessages], "en", words)).toBe("Something went wrong");
	});

	it("a refusal's own reason is what it says", () => {
		const reason = { key: "keys.refused" };
		expect(reasonOf({ status: 422, error: "check", reason })).toBe(reason);
	});
});

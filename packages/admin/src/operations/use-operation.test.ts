import { coreMessages, formatMessage } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { isNewAnswer, reasonOf } from "./use-operation";

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

describe("isNewAnswer", () => {
	it("the same input read again with the same answer keeps the one the screen holds", () => {
		expect(isNewAnswer({ key: "a", text: "[]" }, { key: "a", text: "[]" })).toBe(false);
	});

	it("another answer to the same input is new", () => {
		expect(isNewAnswer({ key: "a", text: "[]" }, { key: "a", text: "[1]" })).toBe(true);
	});

	it("an answer to another input is new even when it reads the same: two empty folders answer alike, and the picker marks the folder answered by it", () => {
		expect(isNewAnswer({ key: "folder-a", text: "[]" }, { key: "folder-b", text: "[]" })).toBe(true);
	});

	it("the first answer is new", () => {
		expect(isNewAnswer(null, { key: "a", text: "[]" })).toBe(true);
	});
});

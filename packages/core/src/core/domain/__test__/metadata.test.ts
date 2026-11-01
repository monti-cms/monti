import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import { normalizeMetadata } from "../metadata";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? { code: error.code } : "other";
	}
	return null;
};

describe("metadata", () => {
	it("WRITE-S7 accepts an object with no prototype and a key named __proto__ as plain data", () => {
		const input = JSON.parse('{"__proto__": {"x": 1}, "constructor": "c"}');
		const normalized = normalizeMetadata(input);
		expect(Object.keys(normalized).sort()).toEqual(["__proto__", "constructor"]);
		expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
	});

	it("WRITE-S7 rejects what is not a plain JSON object with invalid_input", () => {
		for (const input of [
			null,
			[],
			"text",
			1,
			new Date(),
			new Map(),
			{ a: Number.NaN },
			{ a: Number.POSITIVE_INFINITY },
			{ a: () => 1 },
			{ a: undefined },
			{ a: new Date() },
		]) {
			expect(codeOf(() => normalizeMetadata(input))).toMatchObject({ code: "invalid_input" });
		}
	});
});

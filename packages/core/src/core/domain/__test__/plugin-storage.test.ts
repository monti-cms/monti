import { describe, expect, it } from "vitest";
import { CmsError } from "../../store/errors";
import { assertExpectedVersionNumber, assertStorageKey, serializeStorageValue } from "../plugin-storage";

const codeOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError ? error.code : "other";
	}
	return null;
};

describe("plugin storage rules", () => {
	it("PLUG-D1 keys are any non-empty text", () => {
		expect(codeOf(() => assertStorageKey("a/b c:ü"))).toBeNull();
		expect(codeOf(() => assertStorageKey(""))).toBe("invalid_input");
	});

	it("PLUG-D2 an expected version is 0 or a whole number that was read, and a stored version starts at 1", () => {
		expect(codeOf(() => assertExpectedVersionNumber(0))).toBeNull();
		expect(codeOf(() => assertExpectedVersionNumber(12))).toBeNull();
		for (const version of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(codeOf(() => assertExpectedVersionNumber(version))).toBe("invalid_input");
		}
	});

	it("PLUG-D1 stores values as JSON text, and rejects what JSON cannot hold", () => {
		expect(serializeStorageValue({ b: [1, null], a: "x" })).toBe('{"b":[1,null],"a":"x"}');
		expect(serializeStorageValue(null)).toBe("null");
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		for (const value of [undefined, () => 1, Symbol("s"), circular, 10n]) {
			expect(codeOf(() => serializeStorageValue(value))).toBe("invalid_input");
		}
	});
});

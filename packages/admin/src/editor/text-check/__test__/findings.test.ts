import { describe, expect, it } from "vitest";
import { fixAllReplacements } from "../findings";

const finding = (from: number, to: number, ...suggestions: string[]) => ({ from, to, suggestions });

describe("fix all replacements", () => {
	it("PLUG-T3 goes from the last finding to the first, so an earlier replacement does not move a later one", () => {
		expect(fixAllReplacements([finding(2, 4, "가"), finding(10, 13, "나"), finding(6, 8, "다")])).toEqual([
			{ from: 10, to: 13, text: "나" },
			{ from: 6, to: 8, text: "다" },
			{ from: 2, to: 4, text: "가" },
		]);
	});

	it("PLUG-T3 takes the first suggestion and skips a finding that has none", () => {
		expect(fixAllReplacements([finding(1, 3, "첫째", "둘째"), finding(5, 7)])).toEqual([
			{ from: 1, to: 3, text: "첫째" },
		]);
	});

	it("PLUG-T3 leaves out a finding that overlaps one after it", () => {
		expect(fixAllReplacements([finding(1, 6, "가"), finding(4, 9, "나")])).toEqual([{ from: 4, to: 9, text: "나" }]);
	});
});

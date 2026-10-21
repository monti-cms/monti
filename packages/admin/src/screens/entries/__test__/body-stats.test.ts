import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/mdx";
import { bodyStats } from "../body-stats";

describe("body stats", () => {
	it("counts characters without whitespace, nested blocks included", () => {
		expect(bodyStats(docOf("안녕 하세요\n\n- 하나 둘\n- 셋")).chars).toBe(9);
	});

	it("reads about 500 characters a minute, and never less than one minute", () => {
		expect(bodyStats(docOf("")).minutes).toBe(1);
		expect(bodyStats(docOf("가".repeat(500))).minutes).toBe(1);
		expect(bodyStats(docOf("가".repeat(1500))).minutes).toBe(3);
	});
});

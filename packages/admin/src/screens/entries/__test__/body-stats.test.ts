import { describe, expect, it } from "vitest";
import { docOf } from "../../../test/mdx";
import { bodyChars } from "../body-stats";

describe("body chars", () => {
	it("counts characters without whitespace, nested blocks included", () => {
		expect(bodyChars(docOf("안녕 하세요\n\n- 하나 둘\n- 셋"))).toBe(9);
	});

	it("does not split a word that holds a bold part, and counts an empty body as zero", () => {
		expect(bodyChars(docOf("안**녕**하세요\n\n\n\n둘"))).toBe(6);
		expect(bodyChars(docOf(""))).toBe(0);
	});
});

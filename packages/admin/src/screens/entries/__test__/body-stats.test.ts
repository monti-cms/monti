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

describe("body stats, extra counts", () => {
	it("counts characters with spaces, words, paragraphs and headings", () => {
		const stats = bodyStats(docOf("# 제목 입니다\n\n안녕 하세요\n\n- 하나 둘\n- 셋"));
		expect(stats).toMatchObject({ chars: 14, charsWithSpaces: 17, words: 7, paragraphs: 3, headings: 1 });
	});

	it("does not split a word that holds a bold part, and skips empty blocks", () => {
		const stats = bodyStats(docOf("안**녕**하세요\n\n\n\n둘"));
		expect(stats.words).toBe(2);
		expect(stats.paragraphs).toBe(2);
	});
});

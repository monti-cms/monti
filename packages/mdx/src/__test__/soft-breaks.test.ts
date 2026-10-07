import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { analyze, toDocument } from "../format";
import { insertSoftBreaks } from "../soft-breaks";

const document = (source: string) => toDocument(testSite, analyze(testSite, source));

/** The new string of a body that changes (the test fails when it does not). */
const migrated = (source: string): string => {
	const result = insertSoftBreaks(testSite, source);
	if (result.status !== "changed") throw new Error(`expected a change, got ${result.status}: ${source}`);
	return result.mdx;
};

/** What was added is only `<br />` elements: taking them out gives the old string back. */
const onlyBreaksAdded = (source: string) => migrated(source).replaceAll("<br />", "") === source;

describe("soft line endings made explicit", () => {
	it("writes a <br /> at each single newline inside paragraph text, and reads as the same document with explicit breaks", () => {
		const result = migrated("첫 줄\n둘째 줄\n셋째 줄\n\n다음 문단\n두 줄");
		expect(result).toBe("첫 줄<br />\n둘째 줄<br />\n셋째 줄\n\n다음 문단<br />\n두 줄");
		expect(document(result)).toEqual(document("첫 줄<br />둘째 줄<br />셋째 줄\n\n다음 문단<br />두 줄"));
	});

	it("changes nothing but the breaks, so a body keeps its exact text otherwise", () => {
		const source =
			"# 제목\n\n**굵게**와 `코드`\n그리고 [링크](https://example.com)\n\n- 하나\n  이어서\n- 둘\n\n> 인용\n> 이어서\n\n끝\n";
		expect(onlyBreaksAdded(source)).toBe(true);
	});

	it("is a no-op the second time", () => {
		const once = migrated("가\n나");
		expect(insertSoftBreaks(testSite, once)).toEqual({ status: "unchanged" });
	});

	it("leaves a body with no soft line ending as it is", () => {
		for (const source of ["", "한 줄", "가\n\n나", "가<br />\n나", "가\\\n나", "가  \n나", "<br />\n\n나"]) {
			expect(insertSoftBreaks(testSite, source), source).toEqual({ status: "unchanged" });
		}
	});

	it("does not touch text that is not paragraph prose", () => {
		const sources = [
			"```ts\nconst a = 1;\nconst b = 2;\n```",
			"~~~\n여러\n줄\n~~~",
			"$$\nx^2\n+ y^2\n$$",
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			"제목\n===",
			"{/* 여러\n줄 주석 */}",
			'<Tooltip content="여러\n줄 속성">글자</Tooltip>',
			"<Table>\n<TableRow>\n<TableCell>가\n나</TableCell>\n</TableRow>\n</Table>",
		];
		for (const source of sources) {
			const result = insertSoftBreaks(testSite, source);
			expect(result.status === "changed" ? result.mdx : source, source).toBe(source);
		}
	});

	it("does not touch inline code or a text expression inside a paragraph, only the prose around it", () => {
		const source = "앞 `코드` 와\n{1 + 1} 뒤";
		expect(migrated(source)).toBe("앞 `코드` 와<br />\n{1 + 1} 뒤");
	});

	it("reaches paragraphs inside lists, quotes, footnotes and containers", () => {
		const bodies = [
			"- 하나\n  이어서\n",
			"1. 하나\n   이어서\n",
			"> 인용\n> 이어서\n",
			"본문[^1]\n\n[^1]: 각주\n    이어서\n",
			'<TextAlign align="center">\n\n가운데\n이어서\n\n</TextAlign>\n',
		];
		for (const body of bodies) {
			expect(onlyBreaksAdded(body), body).toBe(true);
			expect(insertSoftBreaks(testSite, migrated(body)), body).toEqual({ status: "unchanged" });
		}
	});

	it("keeps the front matter and CRLF line endings", () => {
		expect(migrated("---\ntitle: t\n---\n가\n나")).toBe("---\ntitle: t\n---\n가<br />\n나");
		expect(migrated("가\r\n나\r\n다")).toBe("가<br />\r\n나<br />\r\n다");
	});

	it("keeps the words of a line that ends in spaces", () => {
		const result = migrated("가 \n나");
		expect(result.replace("<br />", "")).toBe("가 \n나");
		expect(document(result)).toEqual(document("가<br />나"));
	});

	it("does not insert into a line ending that is already a hard break", () => {
		const result = migrated("가\\\n나\n다");
		expect(result).toBe("가\\\n나<br />\n다");
	});

	it("leaves a body that does not parse untouched and says so", () => {
		expect(insertSoftBreaks(testSite, "가\n<Unclosed")).toMatchObject({ status: "skipped", reason: "unparsed" });
	});

	it("keeps what the public page showed: every soft ending is one break, no more", () => {
		const source = "가\n나\n다";
		const breaks = (text: string) => JSON.stringify(document(text)).match(/"hardBreak"/g)?.length ?? 0;
		expect(breaks(migrated(source))).toBe(source.split("\n").length - 1);
	});
});

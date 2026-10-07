import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import { unparsedDocument } from "../../doc/stored-document";
import { documentText, SEARCH_TEXT } from "../body-text";
import { bodyExcerpt, toPlainText } from "../plain-text";

/** The text of a body written as text (see `test/doc-text.ts`): of the document a write stores for it. */
const plain = (mdx: string) => toPlainText(testSite, docOf(mdx));
const excerpt = (mdx: string, maxLength?: number) => bodyExcerpt(testSite, docOf(mdx), maxLength);

describe("body plain text and automatic summary", () => {
	it("keeps a word that emphasis splits as one word, and sets apart the words of different blocks", () => {
		expect(plain("한**글**\n\n다음")).toBe("한글 다음");
		expect(plain("# 제목\n본문")).toBe("제목 본문");
		expect(plain("- 하나\n- 둘")).toBe("하나 둘");
	});

	it("truncates long text and returns empty for bodies without prose", () => {
		expect(Array.from(excerpt("가".repeat(300), 10))).toHaveLength(10);
		expect(excerpt("```js\nonly();\n```")).toBe("");
		expect(excerpt("")).toBe("");
	});

	it("still gives text for a body that does not parse", () => {
		expect(toPlainText(testSite, unparsedDocument("끝나지 않은 <Box> 문장"))).toContain("문장");
	});
});

describe("body search text", () => {
	const search = (mdx: string) => documentText(testSite, docOf(mdx), SEARCH_TEXT);

	it("is the plain words for plain Markdown, in one line", () => {
		expect(search("second words")).toBe("second words");
		expect(search("# 제목\n\n**굵게** 와 _기울임_\n\n- 하나\n- 둘\n\n> 인용")).toBe("제목 굵게 와 기울임 하나 둘 인용");
		expect(search("")).toBe("");
	});

	it("finds a phrase across a line ending, and keeps the label of a link, not its address", () => {
		expect(search("앞 줄\n뒷 줄")).toContain("앞 줄 뒷 줄");
		expect(search("[라벨](https://example.com/주소)")).toBe("라벨");
	});
});

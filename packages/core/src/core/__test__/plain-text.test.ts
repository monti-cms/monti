import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import { bodyText, SEARCH_TEXT } from "../body-text";
import { bodyExcerpt, toPlainText } from "../plain-text";

/** A container block with a translatable text attribute (a callout's title) and a value for that attribute; the site's blocks are looked up, not named. */
const titled = (() => {
	for (const block of ADDED_BLOCKS) {
		if (block.syntax.kind !== "container" || block.children || block.parent) continue;
		const attribute = Object.entries(block.attributes).find(([, candidate]) => candidate.translatable);
		if (attribute) return { component: block.component, attribute: attribute[0] };
	}
	return undefined;
})();

describe("body plain text and automatic summary", () => {
	it("keeps readable text and drops code, math, images and the syntax around them", () => {
		const mdx = [
			"## 개요",
			"",
			"**굵은** 문장과 [링크](/posts/a), <u>밑줄</u> 표현.",
			"",
			"```ts",
			"const hidden = 1;",
			"```",
			"",
			'<Image mediaId="x" alt="설명" />',
			"",
			"$$",
			"x^2",
			"$$",
			"",
			"- [ ] 할 일",
			"",
			"| 머리 | 칸 |",
			"| --- | --- |",
			"| 셀 | 값 |",
		].join("\n");
		expect(toPlainText(mdx)).toBe("개요 굵은 문장과 링크, 밑줄 표현. 할 일 머리 칸 셀 값");
	});

	it("reads the text of a block body and of the text attributes the block definition marks translatable", () => {
		if (!titled) return;
		const { component, attribute } = titled;
		const mdx = `앞 문장.\n\n<${component} ${attribute}="상자 제목">\n\n상자 안 문장\n\n</${component}>\n\n뒷 문장.`;
		expect(toPlainText(mdx)).toBe("앞 문장. 상자 제목 상자 안 문장 뒷 문장.");
	});

	it("keeps a word that emphasis splits as one word, and sets apart the words of different blocks", () => {
		expect(toPlainText("한**글**\n\n다음")).toBe("한글 다음");
		expect(toPlainText("# 제목\n본문")).toBe("제목 본문");
		expect(toPlainText("- 하나\n- 둘")).toBe("하나 둘");
	});

	it("leaves out text the page does not show", () => {
		expect(toPlainText("공개 <Untranslated>번역 안내</Untranslated> 문장")).toBe("공개 문장");
	});

	it("truncates long text and returns empty for bodies without prose", () => {
		expect(Array.from(bodyExcerpt("가".repeat(300), 10))).toHaveLength(10);
		expect(bodyExcerpt("```js\nonly();\n```")).toBe("");
		expect(bodyExcerpt("")).toBe("");
	});

	it("still gives text for a body that does not parse", () => {
		expect(toPlainText("끝나지 않은 <Box> 문장")).toContain("문장");
	});
});

describe("body search text", () => {
	const search = (mdx: string) => bodyText(mdx, SEARCH_TEXT);

	it("is the plain words for plain Markdown, in one line", () => {
		expect(search("second words")).toBe("second words");
		expect(search("# 제목\n\n**굵게** 와 _기울임_\n\n- 하나\n- 둘\n\n> 인용")).toBe("제목 굵게 와 기울임 하나 둘 인용");
		expect(search("")).toBe("");
	});

	it("finds a phrase across a line ending, and keeps the label of a link, not its address", () => {
		expect(search("앞 줄\n뒷 줄")).toContain("앞 줄 뒷 줄");
		expect(search("[라벨](https://example.com/주소)")).toBe("라벨");
	});

	it("keeps code and math as written, and the alt text and caption of an image", () => {
		const text = search(
			[
				"```ts",
				"const needle = 1;",
				"```",
				"",
				"인라인 `inlineNeedle` 코드",
				"",
				"$$",
				"x^2",
				"$$",
				"",
				"![마크다운 대체글](/a.png)",
				"",
				'<Image mediaId="x" alt="블록 대체글" caption="캡션 글" />',
			].join("\n"),
		);
		for (const piece of ["const needle = 1;", "inlineNeedle", "x^2", "마크다운 대체글", "블록 대체글", "캡션 글"]) {
			expect(text, piece).toContain(piece);
		}
		expect(text).not.toContain("/a.png");
	});

	it("indexes the code of a fence without its annotation comments", () => {
		const text = search(
			["```ts", "// @line plus", "const needle = 1;", "// @char strong {6-6}", "const other = 2;", "```"].join("\n"),
		);
		expect(text).toBe("const needle = 1; const other = 2;");
		expect(text).not.toContain("@line");
		expect(text).not.toContain("@char");
	});

	it("keeps the text attributes of blocks and the hover text of a text decoration", () => {
		if (titled) {
			const { component, attribute } = titled;
			expect(search(`<${component} ${attribute}="상자 제목">\n\n안\n\n</${component}>`)).toContain("상자 제목");
		}
		const decoration = ADDED_BLOCKS.find(
			(block) =>
				block.syntax.kind === "text" && Object.values(block.attributes).some((attribute) => attribute.translatable),
		);
		const attribute =
			decoration && Object.entries(decoration.attributes).find(([, candidate]) => candidate.translatable)?.[0];
		if (decoration && attribute) {
			const mdx = `앞 <${decoration.component} ${attribute}="숨은 설명">글자</${decoration.component}> 뒤`;
			expect(search(mdx)).toBe("앞 글자 숨은 설명 뒤");
			expect(toPlainText(mdx)).toBe("앞 글자 뒤");
		}
	});

	it("does not read markup as text", () => {
		const text = search('<u>밑줄</u> {/* 주석 */} <Image mediaId="x" alt="a" />');
		expect(text).not.toMatch(/[<>]/);
		expect(text).not.toContain("주석");
	});

	it("falls back to the string for a body that does not parse: visible words stay, comments, imports and addresses go", () => {
		const text = search('{/* 주석 */}\nexport const a = { b: "내보냄" };\n보이는 말 [라벨](https://example.com/주소)');
		expect(text).toContain("보이는 말 라벨");
		for (const gone of ["주석", "내보냄", "주소"]) expect(text).not.toContain(gone);
	});

	it("keeps translation notes, which are removed before publishing and which an editor may look for", () => {
		expect(search("공개 <Untranslated>번역 안내</Untranslated>")).toBe("공개 번역 안내");
	});
});

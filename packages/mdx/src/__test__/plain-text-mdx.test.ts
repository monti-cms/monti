import "@monti-cms/core/client";
import { ADDED_BLOCKS } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { documentText, SEARCH_TEXT } from "../../../core/src/core/body-text";
import { toPlainText } from "../../../core/src/core/plain-text";
import { docOfMdx as docOf } from "../testing";

/** The text of a body written as MDX: of the document a write stores for it (an `unparsed` body when it cannot be read). */
const plain = (mdx: string) => toPlainText(docOf(mdx));

/** A container block with a translatable text attribute (a callout's title) and a value for that attribute; the site's blocks are looked up, not named. */
const titled = (() => {
	for (const block of ADDED_BLOCKS) {
		if (block.syntax.kind !== "container" || block.children || block.parent) continue;
		const attribute = Object.entries(block.attributes).find(([, candidate]) => candidate.translatable);
		if (attribute) return { component: block.component, attribute: attribute[0] };
	}
	return undefined;
})();

const search = (mdx: string) => documentText(docOf(mdx), SEARCH_TEXT);

describe("body plain text and search text of MDX", () => {
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
		expect(plain(mdx)).toBe("개요 굵은 문장과 링크, 밑줄 표현. 할 일 머리 칸 셀 값");
	});

	it("reads the text of a block body and of the text attributes the block definition marks translatable", () => {
		if (!titled) return;
		const { component, attribute } = titled;
		const mdx = `앞 문장.\n\n<${component} ${attribute}="상자 제목">\n\n상자 안 문장\n\n</${component}>\n\n뒷 문장.`;
		expect(plain(mdx)).toBe("앞 문장. 상자 제목 상자 안 문장 뒷 문장.");
	});

	it("leaves out text the page does not show", () => {
		expect(plain("공개 <Untranslated>번역 안내</Untranslated> 문장")).toBe("공개 문장");
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
			expect(plain(mdx)).toBe("앞 글자 뒤");
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

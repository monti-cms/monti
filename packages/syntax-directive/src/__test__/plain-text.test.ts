import { toPlainText } from "@monti-cms/core/client";
import { documentText, SEARCH_TEXT } from "@monti-cms/core/testing";
import { docOfMdx } from "@monti-cms/mdx/testing";
import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { directiveSyntax } from "..";

/**
 * Plain text (summary and search text) comes from the parsed body, so the notation a body is written in does not matter: a directive body gives the same
 * text as the same body in standard MDX. The site's blocks are looked up from the config, not named.
 */
const syntax = [directiveSyntax()];

const titled = (() => {
	for (const block of testSite.ADDED_BLOCKS) {
		if (block.syntax.kind !== "container" || block.children || block.parent) continue;
		const attribute = Object.entries(block.attributes).find(([, candidate]) => candidate.translatable);
		if (attribute) return { block, attribute: attribute[0] };
	}
	return undefined;
})();

const bodies = (): { directive: string; standard: string } => {
	const box = titled
		? {
				directive: `:::${titled.block.syntax.kind === "container" ? titled.block.syntax.directive : ""}{${titled.attribute}="상자 제목"}\n상자 안 문장\n:::`,
				standard: `<${titled.block.component} ${titled.attribute}="상자 제목">\n\n상자 안 문장\n\n</${titled.block.component}>`,
			}
		: { directive: "상자 안 문장", standard: "상자 안 문장" };
	return {
		directive: [
			"## 개요",
			"",
			"**굵은** 문장과 [링크](/posts/a), :u[밑줄] 표현 :br[] 다음 줄.",
			"",
			box.directive,
			"",
			'::image{mediaId="x" alt="설명"}',
			"",
			"```ts",
			"const hidden = 1;",
			"```",
			"",
			"- [ ] 할 일",
			"",
		].join("\n"),
		standard: [
			"## 개요",
			"",
			"**굵은** 문장과 [링크](/posts/a), <u>밑줄</u> 표현 <br /> 다음 줄.",
			"",
			box.standard,
			"",
			'<Image mediaId="x" alt="설명" />',
			"",
			"```ts",
			"const hidden = 1;",
			"```",
			"",
			"- [ ] 할 일",
			"",
		].join("\n"),
	};
};

describe("directive syntax: plain text from the parsed body", () => {
	it("gives the same summary text as the body in standard MDX, with no directive syntax left in it", () => {
		const { directive, standard } = bodies();
		const text = toPlainText(testSite, docOfMdx(testSite, directive, syntax));
		expect(text).toBe(toPlainText(testSite, docOfMdx(testSite, standard)));
		expect(text).not.toMatch(/:{1,3}[a-z]|[{}[\]]/);
		expect(text).toContain("개요 굵은 문장과 링크, 밑줄 표현");
		expect(text).toContain("할 일");
		expect(text).not.toContain("hidden");
		if (titled) expect(text).toContain("상자 제목 상자 안 문장");
	});

	it("gives the same search text, with code and the alt text kept", () => {
		const { directive, standard } = bodies();
		const text = documentText(testSite, docOfMdx(testSite, directive, syntax), SEARCH_TEXT);
		expect(text).toBe(documentText(testSite, docOfMdx(testSite, standard), SEARCH_TEXT));
		expect(text).toContain("const hidden = 1;");
		expect(text).toContain("설명");
		expect(text).not.toContain("mediaId");
	});

	it("does not read a directive-looking text as markup when the extension is off", () => {
		expect(toPlainText(testSite, docOfMdx(testSite, ":u[밑줄]"))).toBe(":u[밑줄]");
	});
});

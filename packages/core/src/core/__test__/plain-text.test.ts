import { describe, expect, it } from "vitest";
import { bodyExcerpt, toPlainText } from "../plain-text";

describe("본문 일반 텍스트와 자동 요약(§5.6)", () => {
	it("keeps readable text and drops code, math, images and directive syntax", () => {
		const mdx = [
			"## 개요",
			"",
			"**굵은** 문장과 [링크](/posts/a), :u[밑줄] 표현.",
			"",
			"```ts",
			"const hidden = 1;",
			"```",
			"",
			':::callout{variant="note"}',
			"콜아웃 안 문장",
			":::",
			"",
			'::image{mediaId="x" alt="설명"}',
			"",
			"$$",
			"x^2",
			"$$",
			"",
			"- [ ] 할 일",
		].join("\n");
		expect(toPlainText(mdx)).toBe("개요 굵은 문장과 링크, 밑줄 표현. 콜아웃 안 문장 할 일");
	});

	it("truncates long text and returns empty for bodies without prose", () => {
		expect(Array.from(bodyExcerpt("가".repeat(300), 10))).toHaveLength(10);
		expect(bodyExcerpt("```js\nonly();\n```")).toBe("");
	});
});

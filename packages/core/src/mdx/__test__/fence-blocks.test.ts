import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, BLOCKS } from "../../blocks/active";
import { analyze } from "../analyze";
import { remarkFenceBlocksToMdx } from "../remark-fence-blocks";

/**
 * 블록 이름은 지금 설정에서 찾는다(블로그 예시 설정은 `mermaid`·`chart`, 다른 사이트 설정은 `chart`·`map`).
 * 자식 개수가 정해진 묶음 블록(예: 탭 묶음)이 없는 설정이면 그 경우는 건너뛴다.
 */
const fenceBlock = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");
if (fenceBlock?.syntax.kind !== "fence") throw new Error("fence-blocks test: the config has no fence block");
const fenceLang = fenceBlock.syntax.lang;
/** 최소·최대 자식 개수가 있는 묶음 블록과 그 자식(예: 탭 묶음·탭). */
const group = ADDED_BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const { min, max } = block.children ?? {};
	return child && min && max !== undefined ? [{ block, child, min, max }] : [];
})[0];
const run = (body: string): Root => {
	const processor = unified().use(remarkParse).use(remarkMdx).use(remarkFenceBlocksToMdx);
	return processor.runSync(processor.parse(body)) as Root;
};

describe("코드 펜스 블록의 공개 렌더", () => {
	it("더한 블록의 언어는 그 렌더러로 바꾸고 코드를 `source`로 넘긴다", () => {
		// 언어 이름의 대소문자는 가리지 않는다.
		const lang = `${fenceLang.charAt(0).toUpperCase()}${fenceLang.slice(1)}`;
		const [node] = run(`\`\`\`${lang}\ngraph TD\n  A --> B\n\`\`\`\n`).children;
		expect(node).toMatchObject({
			type: "mdxJsxFlowElement",
			name: fenceBlock.component,
			attributes: [{ type: "mdxJsxAttribute", name: "source", value: "graph TD\n  A --> B" }],
			children: [],
		});
	});

	it("다른 언어의 코드 블록은 그대로 둔다", () => {
		const [node] = run("```ts\nconst a = 1;\n```\n").children;
		expect(node).toMatchObject({ type: "code", lang: "ts" });
	});

	it("더한 블록의 렌더러 이름은 본문 JSX로도 받는다", () => {
		expect(analyze(`<${fenceBlock.component} source="chart bar" />\n`).errors).toEqual([]);
		expect(analyze("<Unknown />\n").errors.map(({ code, params }) => ({ code, params }))).toEqual([
			{ code: "disallowed_jsx_element", params: { name: "Unknown" } },
		]);
	});
});

describe("더한 블록의 자식 개수", () => {
	it.skipIf(!group)("정의의 최소·최대 개수를 벗어나면 막는다", () => {
		if (!group) return;
		const { block, child, min, max } = group;
		// 필수 글 속성(예: 탭 이름)만 채운다.
		const props = (index: number) =>
			Object.entries(child.attributes)
				.filter(([, attribute]) => attribute.type === "string" && attribute.required)
				.map(([name]) => ` ${name}="${index}"`)
				.join("");
		const groupOf = (count: number) =>
			[
				`<${block.component}>`,
				...Array.from(
					{ length: count },
					(_, index) => `<${child.component}${props(index)}>\n본문\n</${child.component}>`,
				),
				`</${block.component}>`,
				"",
			].join("\n");
		expect(analyze(groupOf(min - 1)).errors.map((error) => error.message)).toEqual([
			`${block.component}는 ${min}~${max}개의 ${child.component}만 허용합니다.`,
		]);
		expect(analyze(groupOf(min)).errors).toEqual([]);
	});
});

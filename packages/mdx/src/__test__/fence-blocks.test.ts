import { ADDED_BLOCKS, BLOCKS } from "@monti-cms/core/client";
import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { remarkFenceBlocksToMdx } from "../remark-fence-blocks";

/**
 * Block names are looked up from the current config (the reference blog setup has `mermaid` and `chart`; another site's config has `chart` and `map`).
 * If the config has no group block with a fixed child count (e.g. a tabs group), that case is skipped.
 */
const fenceBlock = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");
if (fenceBlock?.syntax.kind !== "fence") throw new Error("fence-blocks test: the config has no fence block");
const fenceLang = fenceBlock.syntax.lang;
/** A group block with minimum/maximum child counts and its child (e.g. a tabs group and a tab). */
const group = ADDED_BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const { min, max } = block.children ?? {};
	return child && min && max !== undefined ? [{ block, child, min, max }] : [];
})[0];
const run = (body: string): Root => {
	const processor = unified().use(remarkParse).use(remarkMdx).use(remarkFenceBlocksToMdx);
	return processor.runSync(processor.parse(body)) as Root;
};

describe("public render of code fence blocks", () => {
	it("converts the language of an added block to its renderer and passes the code as `source`", () => {
		// Language names are case-insensitive.
		const lang = `${fenceLang.charAt(0).toUpperCase()}${fenceLang.slice(1)}`;
		const [node] = run(`\`\`\`${lang}\ngraph TD\n  A --> B\n\`\`\`\n`).children;
		expect(node).toMatchObject({
			type: "mdxJsxFlowElement",
			name: fenceBlock.component,
			attributes: [{ type: "mdxJsxAttribute", name: "source", value: "graph TD\n  A --> B" }],
			children: [],
		});
	});

	it("leaves code blocks of other languages as they are", () => {
		const [node] = run("```ts\nconst a = 1;\n```\n").children;
		expect(node).toMatchObject({ type: "code", lang: "ts" });
	});

	it("also accepts the renderer name of an added block as body JSX", () => {
		expect(analyze(`<${fenceBlock.component} source="chart bar" />\n`).errors).toEqual([]);
		expect(analyze("<Unknown />\n").errors.map(({ code, params }) => ({ code, params }))).toEqual([
			{ code: "disallowed_jsx_element", params: { name: "Unknown" } },
		]);
	});
});

describe("child count of added blocks", () => {
	it.skipIf(!group)("blocks counts outside the definition's minimum and maximum", () => {
		if (!group) return;
		const { block, child, min, max } = group;
		// Fill in only the required text attributes (e.g. the tab name).
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

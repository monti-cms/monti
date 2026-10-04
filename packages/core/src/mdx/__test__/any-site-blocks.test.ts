import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { analyze, serialize, toDocument } from "..";

/**
 * 설정에 더한 블록(블록 확장·사이트 블록)의 본문 왕복(M10-1 재발 방지). 블록 이름을 적지 않고 지금 설정에서 읽는다.
 * 블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다. 자식 규칙이 있거나 부모 안에서만 쓰는 블록(탭·단)은 뺀다.
 */

const attributeText = (block: BlockDefinition) =>
	Object.entries(block.attributes)
		.flatMap(([name, attribute]) => {
			if (attribute.type !== "string") return [];
			const value = attribute.options ? Object.keys(attribute.options)[0] : attribute.required ? "value" : undefined;
			return value === undefined ? [] : [`${name}="${value}"`];
		})
		.join(" ");

function sampleOf(block: BlockDefinition): string | undefined {
	if (block.children || block.parent) return undefined;
	const attrs = attributeText(block);
	const braces = attrs ? `{${attrs}}` : "";
	switch (block.syntax.kind) {
		case "container":
			return `:::${block.syntax.directive}${braces}\nInside text\n:::\n`;
		case "leaf":
			return `::${block.syntax.directive}${braces}\n`;
		case "fence":
			return `\`\`\`${block.syntax.lang}\nline one\nline two\n\`\`\`\n`;
		default:
			return undefined;
	}
}

const samples = ADDED_BLOCKS.flatMap((block) => {
	const mdx = sampleOf(block);
	return mdx ? [[block.name, mdx] as const] : [];
});

describe("any site: added blocks round-trip", () => {
	it("the active config adds at least one block", () => {
		expect(samples.length).toBeGreaterThan(0);
	});

	it.each(samples)("%s keeps its syntax through analyze → document → serialize", (_name, mdx) => {
		const first = analyze(mdx);
		expect(first.errors).toEqual([]);
		const serialized = serialize(toDocument(first));
		const second = analyze(serialized);
		expect(second.errors).toEqual([]);
		expect(toDocument(second)).toEqual(toDocument(first));
	});
});

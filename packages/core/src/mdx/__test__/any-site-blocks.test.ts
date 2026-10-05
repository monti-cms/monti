import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { analyze, serialize, toDocument } from "..";

/**
 * Body round trip of blocks added in config (block extensions and site blocks), as a regression guard. Block names are not hard-coded; they are read from the current config.
 * Runs with both the reference blog setup and another site's config. Blocks with child rules or used only inside a parent (tabs, columns) are skipped.
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
	const open = `${block.component}${attrs ? ` ${attrs}` : ""}`;
	switch (block.syntax.kind) {
		case "container":
			return `<${open}>\n\nInside text\n\n</${block.component}>\n`;
		case "leaf":
			return `<${open} />\n`;
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

	it.each(samples)("%s keeps its content through analyze → document → serialize", (_name, mdx) => {
		const first = analyze(mdx);
		expect(first.errors).toEqual([]);
		const serialized = serialize(toDocument(first));
		// The standard notation is JSX, so the written block is the block that was read.
		expect(serialized).toBe(mdx);
		const second = analyze(serialized);
		expect(second.errors).toEqual([]);
		expect(toDocument(second)).toEqual(toDocument(first));
	});
});

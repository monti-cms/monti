import { computeContentHash } from "@monti-cms/core/runtime";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { analyze } from "../format";
import type { SyntaxExtension } from "../index";
import { docOfMdx } from "../testing";

const metadata = { title: "A" };
/** The hash of a body written as MDX: of the document a write stores for it. */
const hashOf = (mdx: string, syntax: readonly SyntaxExtension[] = []) =>
	computeContentHash(metadata, docOfMdx(testSite, mdx, syntax));

/** The content hash is over the stored document, so MDX written in different ways that read the same hash equally. */
describe("content hash of MDX spellings", () => {
	it("a notation an extension reads and the standard JSX of the same meaning", () => {
		// A made-up notation: `@@word@@` is read as `<u>word</u>`.
		const atNotation: SyntaxExtension = {
			name: "at",
			remarkPlugins: [
				() => (tree: Root) => {
					visit(tree, "text", (node, index, parent) => {
						const match = /@@(\w+)@@/.exec(node.value);
						if (!match || index == null || !parent) return;
						parent.children.splice(index, 1, {
							type: "mdxJsxTextElement",
							name: "u",
							attributes: [],
							children: [{ type: "text", value: match[1] ?? "" }],
						} as never);
					});
				},
			],
		};
		const notation = "@@word@@\n";
		const standard = "<u>word</u>\n";
		expect(analyze(testSite, notation, undefined, [atNotation]).errors).toEqual([]);
		expect(hashOf(notation, [atNotation])).toBe(hashOf(standard));
		// Without the extension the notation is plain text, which hashes differently.
		expect(hashOf(notation)).not.toBe(hashOf(standard));
	});

	it("emphasis written with asterisks or underscores", () => {
		expect(hashOf("An *a* word")).toBe(hashOf("An _a_ word"));
	});

	it("JSX attributes listed in a different order", () => {
		const image = (attributes: string) => `<Image ${attributes} />\n`;
		const a = image('src="https://example.com/a.png" alt="A" width="50"');
		const b = image('width="50" alt="A" src="https://example.com/a.png"');
		expect(analyze(testSite, a).errors).toEqual([]);
		expect(hashOf(a)).toBe(hashOf(b));
	});

	it("an unclosed element is one body per raw string", () => {
		const broken = "<Callout>\nInside\n";
		expect(analyze(testSite, broken).errors.length).toBeGreaterThan(0);
		expect(hashOf(broken)).toBe(hashOf(broken));
		expect(hashOf(`${broken}more`)).not.toBe(hashOf(broken));
	});
});

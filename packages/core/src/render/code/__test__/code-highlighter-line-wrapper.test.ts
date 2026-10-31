import type { Element, ElementContent } from "hast";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { siteHighlight } from "../code-highlighter";

const highlight = await siteHighlight(testSite);

const textOf = (node: ElementContent): string =>
	node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

/** The children of the highlighted `code` element as `[tag, text]` pairs (`#text` for a text node), so the place of a wrapper reads as its lines. */
const outline = (hast: { children: unknown[] }) => {
	const pre = hast.children[0] as Element;
	expect(pre).toMatchObject({ tagName: "pre", children: [{ tagName: "code" }] });
	const code = pre.children[0] as Element;
	return code.children.map((node) => [node.type === "element" ? node.tagName : `#${node.type}`, textOf(node)]);
};

describe("highlight line wrapper integration", () => {
	it("SITE-D2 injects line wrapper into highlighted hast", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);
		// The wrapper holds both lines.
		expect(outline(hast)).toEqual([["Callout", "const a = 1\nconst b = 2"]]);
	});

	it("SITE-D2 renders without a line count mismatch even when decorations and a line wrapper are used together", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				decorations: [
					{
						start: { line: 0, character: 0 },
						end: { line: 0, character: 5 },
						properties: {
							"data-anno-render": "Tooltip",
							"data-anno-content": '"const"',
						},
					},
				],
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);

		expect(outline(hast)).toEqual([["Callout", "const a = 1\nconst b = 2"]]);
		// The inline tag stays inside the first line of the wrapper.
		const code = (hast.children[0] as Element).children[0] as Element;
		const wrapper = code.children[0] as Element;
		const lines = wrapper.children.filter((node): node is Element => node.type === "element");
		expect(lines.map((line) => [line.properties.class, textOf(line)])).toEqual([
			["line", "const a = 1"],
			["line", "const b = 2"],
		]);
		expect(lines[0]?.children[0]).toMatchObject({ tagName: "Tooltip", properties: { content: "const" } });
	});

	it("SITE-D2 applies up to EOF even when the line wrapper range end exceeds the line count", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 1, end: 99 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);

		// The wrapper starts at the second line and ends at the last one.
		expect(outline(hast)).toEqual([
			["span", "const a = 1"],
			["#text", "\n"],
			["Callout", "const b = 2"],
		]);
	});
});

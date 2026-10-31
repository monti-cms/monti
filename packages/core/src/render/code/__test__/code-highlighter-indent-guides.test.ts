import type { Element, ElementContent } from "hast";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { siteHighlight } from "../code-highlighter";

const highlight = await siteHighlight(testSite);

const hasIndentClass = (node: Element) => {
	const value = node.properties?.class ?? node.properties?.className;
	if (typeof value === "string") return value.split(/\s+/).includes("indent");
	if (Array.isArray(value)) return value.map(String).includes("indent");
	return false;
};

const findIndentNodes = (node: Element): Element[] => {
	const result: Element[] = [];

	for (const child of node.children) {
		if (child.type !== "element") continue;
		if (hasIndentClass(child)) {
			result.push(child);
		}
		result.push(...findIndentNodes(child));
	}

	return result;
};

const textOf = (node: ElementContent): string =>
	node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

describe("highlight indent guides integration", () => {
	// The `indent` class is the render output contract: the public styles draw the indent guides by it.
	it("SITE-D2 renders indent tokens as indent class spans", () => {
		const hast = highlight("function f() {\n  console.log(1)\n    console.log(2)\n}", "ts", {}, {});
		const pre = hast.children[0] as Element;
		expect(pre).toMatchObject({ tagName: "pre", children: [{ tagName: "code" }] });
		const code = pre.children[0] as Element;

		const lines = code.children.filter((node): node is Element => node.type === "element");
		// One span per indent step (two spaces) at the start of each line.
		expect(lines.map((line) => findIndentNodes(line).map(textOf))).toEqual([[], ["  "], ["  ", "  "], []]);
	});
});

import type { Element, ElementContent } from "hast";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { siteHighlight } from "../code-highlighter";

const highlight = await siteHighlight(testSite);

const findCode = (pre: Element) =>
	pre.children.find((child) => child.type === "element" && child.tagName === "code") as Element | undefined;

const findElementByTagName = (root: Element, tagName: string): Element | undefined => {
	if (root.tagName === tagName) return root;

	for (const child of root.children) {
		if (child.type !== "element") continue;
		const found = findElementByTagName(child, tagName);
		if (found) return found;
	}

	return undefined;
};

const textOf = (node: ElementContent): string =>
	node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

describe("highlight inline render integration", () => {
	it("converts inline annotation decorations into render tags", () => {
		const hast = highlight(
			"console.log('hello')",
			"ts",
			{},
			{
				decorations: [
					{
						start: { line: 0, character: 5 },
						end: { line: 0, character: 17 },
						properties: {
							"data-anno-render": "Tooltip",
							"data-anno-content": '"console.log"',
						},
					},
				],
				allowedRenderTags: ["Tooltip"],
			},
		);

		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		const code = pre ? findCode(pre) : undefined;
		const wrapper = code ? findElementByTagName(code, "Tooltip") : undefined;

		// The tag wraps exactly the characters of the decoration (5 up to 17), and its content is the parsed attribute.
		expect(wrapper ? textOf(wrapper) : undefined).toBe("le.log('hell");
		expect(wrapper?.properties.content).toBe("console.log");
		expect(wrapper?.properties["data-anno-render"]).toBeUndefined();
		expect(wrapper?.properties["data-anno-content"]).toBeUndefined();
	});
});

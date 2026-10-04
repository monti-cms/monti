import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { highlight } from "../code-highlighter";

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

describe("highlight inline render integration", () => {
	it("inline annotation decoration을 render tag로 변환한다", () => {
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
		expect(pre).toBeDefined();

		const code = pre ? findCode(pre) : undefined;
		expect(code).toBeDefined();

		const wrapper = code ? findElementByTagName(code, "Tooltip") : undefined;
		expect(wrapper).toBeDefined();
		expect(wrapper?.properties.content).toBe("console.log");
		expect(wrapper?.properties["data-anno-render"]).toBeUndefined();
		expect(wrapper?.properties["data-anno-content"]).toBeUndefined();
	});
});

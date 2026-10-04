import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { highlight } from "../code-highlighter";

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

describe("highlight indent guides integration", () => {
	it("들여쓰기 토큰을 indent class span으로 렌더링한다", () => {
		const hast = highlight("function f() {\n  console.log(1)\n    console.log(2)\n}", "ts", {}, {});
		const pre = hast.children.find((node): node is Element => node.type === "element" && node.tagName === "pre");
		expect(pre).toBeDefined();

		const code = pre?.children.find((node): node is Element => node.type === "element" && node.tagName === "code");
		expect(code).toBeDefined();

		const indents = code ? findIndentNodes(code) : [];
		expect(indents.length).toBeGreaterThan(0);
	});
});

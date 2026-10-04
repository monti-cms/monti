import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { highlight } from "../code-highlighter";

const findCode = (pre: Element) =>
	pre.children.find((child) => child.type === "element" && child.tagName === "code") as Element | undefined;

describe("highlight line wrapper integration", () => {
	it("injects line wrapper into highlighted hast", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);
		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		expect(pre).toBeDefined();
		const code = pre ? findCode(pre) : undefined;
		expect(code).toBeDefined();

		const wrapper = code?.children.find((node) => node.type === "element" && node.tagName === "Callout");
		expect(wrapper).toBeDefined();
	});

	it("decorations와 line wrapper를 함께 써도 line count mismatch 없이 렌더링한다", () => {
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

		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		expect(pre).toBeDefined();
		const code = pre ? findCode(pre) : undefined;
		expect(code).toBeDefined();

		const wrapper = code?.children.find((node) => node.type === "element" && node.tagName === "Callout");
		expect(wrapper).toBeDefined();
	});

	it("line wrapper range end가 라인 수를 넘어도 EOF까지 적용한다", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 1, end: 99 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);

		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		expect(pre).toBeDefined();
		const code = pre ? findCode(pre) : undefined;
		expect(code).toBeDefined();

		const wrapper = code?.children.find((node) => node.type === "element" && node.tagName === "Callout");
		expect(wrapper).toBeDefined();
	});
});

import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { addMetaToPre } from "../transformers";

const runPreHook = (node: Element, code: string, meta: Record<string, unknown>) => {
	const transformer = addMetaToPre(code, meta);
	const hook = transformer.pre;
	expect(hook).toBeTypeOf("function");
	hook?.call({} as never, node);
};

describe("addMetaToPre", () => {
	it("injects code and meta into the pre properties", () => {
		const pre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};

		runPreHook(pre, "const a = 1", { title: "demo.ts", showLineNumbers: true });

		expect(pre.properties.code).toBe("const a = 1");
		expect(pre.properties.title).toBe("demo.ts");
		expect(pre.properties.showLineNumbers).toBe(true);
	});

	it("works safely even without existing properties", () => {
		const pre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};
		pre.properties = undefined as never;

		runPreHook(pre, "print('hello')", { language: "python" });

		expect(pre.properties).toBeDefined();
		expect(pre.properties?.code).toBe("print('hello')");
		expect(pre.properties?.language).toBe("python");
	});

	it("keeps existing properties and updates the same key with the latest value", () => {
		const pre: Element = {
			type: "element",
			tagName: "pre",
			properties: {
				className: ["shiki"],
				title: "before.ts",
			},
			children: [],
		};

		runPreHook(pre, "const next = 2", { title: "after.ts", collapsed: false });

		expect(pre.properties.className).toEqual(["shiki"]);
		expect(pre.properties.code).toBe("const next = 2");
		expect(pre.properties.title).toBe("after.ts");
		expect(pre.properties.collapsed).toBe(false);
	});
});

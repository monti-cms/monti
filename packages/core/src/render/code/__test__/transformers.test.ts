import type { Element, Root } from "hast";
import type { ShikiTransformer } from "shiki";
import { describe, expect, it } from "vitest";
import * as transformerModule from "../transformers";
import { addMetaToPre, convertInlineAnnoToRenderTag } from "../transformers";

describe("addMetaToPre", () => {
	const runPreHook = (node: Element, code: string, meta: Record<string, unknown>) => {
		const transformer = addMetaToPre(code, meta);
		const hook = transformer.pre;
		expect(hook).toBeTypeOf("function");
		hook?.call({} as never, node);
	};

	it("SITE-D2 injects code and meta into the pre properties", () => {
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

	it("SITE-D2 works safely even without existing properties", () => {
		const pre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};
		pre.properties = undefined as never;

		runPreHook(pre, "print('hello')", { language: "python" });

		expect(pre.properties).toEqual({ code: "print('hello')", language: "python" });
	});

	it("SITE-D2 keeps existing properties and updates the same key with the latest value", () => {
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

describe("convertInlineAnnoToRenderTag", () => {
	const runCodeHook = (codeEl: Element, allowedRenderTags: string[] = ["Tooltip", "strong"]) => {
		const transformer = convertInlineAnnoToRenderTag(allowedRenderTags);
		const hook = transformer.root;
		expect(hook).toBeTypeOf("function");
		const root: Root = {
			type: "root",
			children: [{ type: "element", tagName: "pre", properties: {}, children: [codeEl] }],
		};
		hook?.call({} as never, root);
	};

	const createInlineElement = (properties: Element["properties"]): Element => ({
		type: "element",
		tagName: "span",
		properties,
		children: [{ type: "text", value: "hello" }],
	});

	it("SITE-D2 changes data-anno-render to tagName and converts data-anno-* attributes into plain props", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-open": "true",
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("Tooltip");
		expect(node.properties.variant).toBe("tip");
		expect(node.properties.open).toBe(true);
		expect(node.properties["data-anno-render"]).toBeUndefined();
		expect(node.properties["data-anno-variant"]).toBeUndefined();
		expect(node.properties["data-anno-open"]).toBeUndefined();
	});

	it("SITE-D2 does not convert an invalid render tag", () => {
		const node = createInlineElement({
			"data-anno-render": "Callout<script>",
			"data-anno-variant": '"tip"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("span");
		expect(node.properties.variant).toBeUndefined();
		expect(node.properties["data-anno-render"]).toBe("Callout<script>");
		expect(node.properties["data-anno-variant"]).toBe('"tip"');
	});

	it("SITE-D2 does not convert deny-listed props", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-__proto__": '{"polluted":true}',
			"data-anno-dangerouslySetInnerHTML": '{"__html":"<b>x</b>"}',
			"data-anno-children": '"forbidden"',
			"data-anno-onClick": '"alert(1)"',
			"data-anno-href": '"javascript:alert(1)"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		const props = node.properties as Record<string, unknown>;
		expect(node.tagName).toBe("Tooltip");
		expect(props.variant).toBe("tip");
		expect(props.dangerouslySetInnerHTML).toBeUndefined();
		expect(props.children).toBeUndefined();
		expect(props.onClick).toBeUndefined();
		expect(props.href).toBeUndefined();
		expect(Object.hasOwn(props, "__proto__")).toBe(false);
		expect("polluted" in props).toBe(false);
	});

	it("SITE-D2 does not convert a render tag that is not allowed", () => {
		const node = createInlineElement({
			"data-anno-render": "Callout",
			"data-anno-variant": '"tip"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl, ["Tooltip"]);

		expect(node.tagName).toBe("span");
		expect(node.properties.variant).toBeUndefined();
	});
});

describe("transformers.line addLineDecorations", () => {
	type LineDecorationPayload = {
		scope: "line";
		name: string;
		range: { start: number; end: number };
		class: string;
	};

	const addLineDecorations = (
		transformerModule as unknown as {
			addLineDecorations?: (lineDecorations: LineDecorationPayload[]) => ShikiTransformer;
		}
	).addLineDecorations;

	const createLineElement = (): Element => ({
		type: "element",
		tagName: "span",
		properties: { className: ["line"] },
		children: [],
	});

	const createLineElementWithClassProp = (): Element => ({
		type: "element",
		tagName: "span",
		properties: { class: "line" },
		children: [],
	});

	const runLineHook = (transformer: ShikiTransformer, lineElement: Element, lineNumber: number) => {
		const hook = transformer.line;
		expect(hook).toBeTypeOf("function");
		hook?.call({} as never, lineElement, lineNumber);
	};

	const createTransformer = (lineDecorations: LineDecorationPayload[]) => {
		if (typeof addLineDecorations !== "function") {
			throw new Error("addLineDecorations is not implemented");
		}

		return addLineDecorations(lineDecorations);
	};

	it("SITE-D2 adds the class to lines included in the range (1-based input)", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "diff",
				range: { start: 0, end: 2 },
				class: "diff",
			},
		]);

		const line1 = createLineElement();
		const line2 = createLineElement();
		const line3 = createLineElement();

		runLineHook(transformer, line1, 1);
		runLineHook(transformer, line2, 2);
		runLineHook(transformer, line3, 3);

		expect(line1.properties.className).toEqual(expect.arrayContaining(["line", "diff"]));
		expect(line2.properties.className).toEqual(expect.arrayContaining(["line", "diff"]));
		expect(line3.properties.className).toEqual(["line"]);
	});

	it("SITE-D2 merges classes when several line decorations overlap", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "diff",
				range: { start: 0, end: 3 },
				class: "diff",
			},
			{
				scope: "line",
				name: "focus",
				range: { start: 1, end: 2 },
				class: "focus",
			},
		]);

		const line2 = createLineElement();
		runLineHook(transformer, line2, 2);

		expect(line2.properties.className).toEqual(expect.arrayContaining(["line", "diff", "focus"]));
	});

	it("SITE-D2 ignores an invalid range (start >= end)", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "invalid",
				range: { start: 1, end: 1 },
				class: "invalid",
			},
		]);

		const line2 = createLineElement();
		runLineHook(transformer, line2, 2);

		expect(line2.properties.className).toEqual(["line"]);
	});

	it("SITE-D2 also keeps the base class that came in through the existing class attribute", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "plus",
				range: { start: 0, end: 1 },
				class: "diff plus",
			},
		]);

		const line1 = createLineElementWithClassProp();
		runLineHook(transformer, line1, 1);

		expect(line1.properties.className).toEqual(expect.arrayContaining(["line", "diff plus"]));
	});
});

describe("transformers.root addLineWrappers", () => {
	type LineWrapperPayload = {
		scope: "line";
		name: string;
		range: { start: number; end: number };
		order: number;
		render: string;
		attributes?: { name: string; value: unknown }[];
	};

	const addLineWrappers = (
		transformerModule as unknown as {
			addLineWrappers?: (rowWrappers: LineWrapperPayload[], allowedRenderTags?: string[]) => ShikiTransformer;
		}
	).addLineWrappers;

	const createLineElement = (value: string): Element => ({
		type: "element",
		tagName: "span",
		properties: { className: ["line"] },
		children: [{ type: "text", value }],
	});

	const createCodeElement = (values: string[]) => {
		const lines = values.map((value) => createLineElement(value));
		const children: Element["children"] = [];

		lines.forEach((line, index) => {
			children.push(line);
			if (index < lines.length - 1) {
				children.push({ type: "text", value: "\n" });
			}
		});

		const code: Element = {
			type: "element",
			tagName: "code",
			properties: {},
			children,
		};

		return { code, lines };
	};

	const runRootHook = (transformer: ShikiTransformer, codeEl: Element) => {
		const hook = transformer.root;
		expect(hook).toBeTypeOf("function");
		const root: Root = {
			type: "root",
			children: [{ type: "element", tagName: "pre", properties: {}, children: [codeEl] }],
		};
		hook?.call({} as never, root);
	};

	const createTransformer = (
		rowWrappers: LineWrapperPayload[],
		allowedRenderTags: string[] = ["Callout", "Collapsible"],
	) => {
		if (typeof addLineWrappers !== "function") {
			throw new Error("addLineWrappers is not implemented");
		}

		return addLineWrappers(rowWrappers, allowedRenderTags);
	};

	it("SITE-D2 wraps the lines in the range with a wrapper", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Callout",
				range: { start: 1, end: 3 },
				order: 0,
				render: "Callout",
			},
		]);

		const { code, lines } = createCodeElement(["line1", "line2", "line3"]);
		runRootHook(transformer, code);

		expect(code.children[0]).toBe(lines[0]);
		expect(code.children[1]).toEqual({ type: "text", value: "\n" });

		const wrapper = code.children[2] as Element;
		expect(wrapper.type).toBe("element");
		expect(wrapper.tagName).toBe("Callout");
		expect(wrapper.children).toContain(lines[1]);
		expect(wrapper.children).toContain(lines[2]);
	});

	it("SITE-D2 for wrappers with the same range, the one with the lower order wraps on the outside", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Callout",
				range: { start: 0, end: 1 },
				order: 0,
				render: "Callout",
			},
			{
				scope: "line",
				name: "Collapsible",
				range: { start: 0, end: 1 },
				order: 1,
				render: "Collapsible",
			},
		]);

		const { code, lines } = createCodeElement(["line"]);
		runRootHook(transformer, code);

		const outer = code.children[0] as Element;
		expect(outer.tagName).toBe("Callout");

		const inner = outer.children[0] as Element;
		expect(inner.tagName).toBe("Collapsible");
		expect(inner.children[0]).toBe(lines[0]);
	});

	it("SITE-D2 duplicate wrappers with the same render and range are normalized into one", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Collapsible",
				range: { start: 0, end: 2 },
				order: 0,
				render: "Collapsible",
			},
			{
				scope: "line",
				name: "Collapsible",
				range: { start: 0, end: 2 },
				order: 1,
				render: "Collapsible",
			},
		]);

		const { code, lines } = createCodeElement(["line1", "line2"]);
		runRootHook(transformer, code);

		const outer = code.children[0] as Element;
		expect(outer.tagName).toBe("Collapsible");
		expect(outer.children).toContain(lines[0]);
		expect(outer.children).toContain(lines[1]);
		expect(outer.children.filter((child) => child.type === "element")).toEqual([lines[0], lines[1]]);
	});

	it("SITE-D2 passes wrapper attributes to element properties", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Callout",
				range: { start: 0, end: 1 },
				order: 0,
				render: "Callout",
				attributes: [
					{ name: "variant", value: "tip" },
					{ name: "open", value: true },
					{ name: "onClick", value: "alert(1)" },
					{ name: "href", value: "javascript:alert(1)" },
				],
			},
		]);

		const { code } = createCodeElement(["line"]);
		runRootHook(transformer, code);

		const wrapper = code.children[0] as Element;
		expect(wrapper.properties.variant).toBe("tip");
		expect(wrapper.properties.open).toBe(true);
		expect(wrapper.properties.onClick).toBeUndefined();
		expect(wrapper.properties.href).toBeUndefined();
	});

	it("SITE-D2 ignores an invalid range (start >= end)", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Callout",
				range: { start: 1, end: 1 },
				order: 0,
				render: "Callout",
			},
		]);

		const { code, lines } = createCodeElement(["line1", "line2"]);
		runRootHook(transformer, code);

		expect(code.children[0]).toBe(lines[0]);
		expect(code.children[2]).toBe(lines[1]);
	});

	it("SITE-D2 clamps to EOF and applies the wrapper when the range end exceeds the line count", () => {
		const transformer = createTransformer([
			{
				scope: "line",
				name: "Callout",
				range: { start: 1, end: 99 },
				order: 0,
				render: "Callout",
			},
		]);

		const { code, lines } = createCodeElement(["line1", "line2", "line3"]);
		runRootHook(transformer, code);

		expect(code.children[0]).toBe(lines[0]);
		const wrapper = code.children[2] as Element;
		expect(wrapper.type).toBe("element");
		expect(wrapper.tagName).toBe("Callout");
		expect(wrapper.children).toContain(lines[1]);
		expect(wrapper.children).toContain(lines[2]);
	});

	it("SITE-D2 does not create a wrapper for a render tag that is not allowed", () => {
		const transformer = createTransformer(
			[
				{
					scope: "line",
					name: "Callout",
					range: { start: 0, end: 1 },
					order: 0,
					render: "Callout",
				},
			],
			["Collapsible"],
		);

		const { code, lines } = createCodeElement(["line"]);
		runRootHook(transformer, code);

		expect(code.children[0]).toBe(lines[0]);
	});
});

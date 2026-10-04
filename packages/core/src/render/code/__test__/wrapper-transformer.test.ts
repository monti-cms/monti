import type { Element, Root } from "hast";
import type { ShikiTransformer } from "shiki";
import { describe, expect, it } from "vitest";
import * as transformerModule from "../transformers";

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

describe("transformers.root addLineWrappers", () => {
	it("range에 해당하는 line들을 wrapper로 감싼다", () => {
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

	it("동일 range wrapper는 order가 낮은 항목이 바깥을 감싼다", () => {
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

	it("동일 render/동일 range wrapper 중복은 하나로 정규화한다", () => {
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

	it("wrapper attributes를 element properties로 전달한다", () => {
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

	it("유효하지 않은 range(start >= end)는 무시한다", () => {
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

	it("range end가 라인 수를 초과하면 EOF까지 clamp해서 wrapper를 적용한다", () => {
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

	it("허용되지 않은 render tag는 wrapper를 만들지 않는다", () => {
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

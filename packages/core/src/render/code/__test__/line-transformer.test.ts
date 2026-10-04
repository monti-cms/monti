import type { Element } from "hast";
import type { ShikiTransformer } from "shiki";
import { describe, expect, it } from "vitest";
import * as transformerModule from "../transformers";

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

describe("transformers.line addLineDecorations", () => {
	it("range에 포함된 line(1-based 입력)에 class를 추가한다", () => {
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

	it("여러 line decoration이 겹치면 class를 병합한다", () => {
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

	it("유효하지 않은 range(start >= end)는 무시한다", () => {
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

	it("기존 class 속성으로 들어온 기준 class도 유지한다", () => {
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

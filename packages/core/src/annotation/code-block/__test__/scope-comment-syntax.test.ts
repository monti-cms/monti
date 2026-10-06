import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import type { AnnotationConfig, CodeFence as Code } from "../types";

const { fromCodeFenceToCodeBlockDocument } = fromCodeFenceToCodeBlockDocumentTestable;
const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "plus", kind: "class", class: "diff plus", scopes: ["line"] },
		{ name: "minus", kind: "class", class: "diff minus", scopes: ["line"] },
		{ name: "collapse", kind: "render", render: "collapse", scopes: ["line"] },
		{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] },
	],
};

const parse = (value: string) => {
	const codeNode: Code = {
		type: "code",
		lang: "ts",
		meta: "",
		value,
	};

	return fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
};

describe("scope comment syntax", () => {
	it("@line plus creates a line scope annotation on the 1 code line right below", () => {
		const document = parse(["// @line plus", "const added = 1", "const untouched = 0"].join("\n"));

		expect(document.lines.map((line) => line.value)).toEqual(["const added = 1", "const untouched = 0"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "plus",
				class: "diff plus",
				range: { start: 0, end: 1 },
			}),
		]);
	});

	it("@line plus {0-1} is read as the closed range [0,1], so the internal range end is +1", () => {
		const document = parse(
			["// @line plus {0-1}", "const first = 1", "const second = 2", "const third = 3"].join("\n"),
		);

		expect(document.lines.map((line) => line.value)).toEqual([
			"const first = 1",
			"const second = 2",
			"const third = 3",
		]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "plus",
				class: "diff plus",
				range: { start: 0, end: 2 },
			}),
		]);
	});

	it("@line plus ... @line plus end is parsed as a continuous-range line scope annotation", () => {
		const document = parse(
			["// @line plus", "const first = 1", "const second = 2", "// @line plus end", "const third = 3"].join("\n"),
		);

		expect(document.lines.map((line) => line.value)).toEqual([
			"const first = 1",
			"const second = 2",
			"const third = 3",
		]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "plus",
				class: "diff plus",
				range: { start: 0, end: 2 },
			}),
		]);
	});

	it("@line collapse ... @line collapse end is parsed as a line scope wrapper range", () => {
		const document = parse(
			["// @line collapse", "const first = 1", "const second = 2", "// @line collapse end", "const third = 3"].join(
				"\n",
			),
		);

		expect(document.lines.map((line) => line.value)).toEqual([
			"const first = 1",
			"const second = 2",
			"const third = 3",
		]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "collapse",
				render: "collapse",
				range: { start: 0, end: 2 },
			}),
		]);
	});

	it("@document fold {0-4} applies the closed range [0,4] as an absolute inline range", () => {
		const line = "hello world";
		const document = parse(["// @document fold {0-4}", line].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: { start: 0, end: 5 },
			}),
		]);
	});

	it("@document fold applies to the whole code block when there is no selector", () => {
		const firstLine = "const a = 1";
		const secondLine = "return a";
		const firstEnd = firstLine.length;
		const secondStart = firstEnd + 1;
		const secondEnd = secondStart + secondLine.length;

		const document = parse(["// @document fold", firstLine, secondLine].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([firstLine, secondLine]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: { start: 0, end: firstEnd },
			}),
		]);
		expect(document.lines[1]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: { start: secondStart, end: secondEnd },
			}),
		]);
	});
});

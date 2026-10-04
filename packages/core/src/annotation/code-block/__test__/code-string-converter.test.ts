import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import { __testable__ as fromCodeBlockDocumentToCodeFenceTestable } from "../document-to-code-fence";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationConfigItem,
	CodeBlockDocument,
	InlineAnnotation,
	Line,
	LineAnnotation,
	Range,
} from "../types";

const { fromCodeFenceToCodeBlockDocument } = fromCodeFenceToCodeBlockDocumentTestable;
const { fromCodeBlockDocumentToCodeFence } = fromCodeBlockDocumentToCodeFenceTestable;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char"] },
		{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] },
		{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
		{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
		{ name: "Collapsible", kind: "render", render: "Collapsible", scopes: ["line"] },
	],
};

const isCharRender = (item: AnnotationConfigItem): item is Extract<AnnotationConfigItem, { kind: "render" }> =>
	item.kind === "render" && (item.scopes ?? []).includes("char");
const isLineRender = (item: AnnotationConfigItem): item is Extract<AnnotationConfigItem, { kind: "render" }> =>
	item.kind === "render" && (item.scopes ?? []).includes("line");
const isLineClass = (item: AnnotationConfigItem): item is Extract<AnnotationConfigItem, { kind: "class" }> =>
	item.kind === "class" && (item.scopes ?? []).includes("line");

const charRenderByName = new Map(
	(annotationConfig.annotations ?? [])
		.filter(isCharRender)
		.map((item, priority) => [item.name, { source: item.source ?? "mdx-text", render: item.render, priority }]),
);
const rowClassByName = new Map(
	(annotationConfig.annotations ?? [])
		.filter(isLineClass)
		.map((item, priority) => [item.name, { class: item.class, priority }]),
);
const rowWrapByName = new Map(
	(annotationConfig.annotations ?? [])
		.filter(isLineRender)
		.map((item, priority) => [item.name, { render: item.render, priority }]),
);

const charRender = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): InlineAnnotation => {
	const config = charRenderByName.get(name);
	if (!config) throw new Error(`Unknown charRender config: ${name}`);

	return {
		scope: "char",
		source: config.source,
		render: config.render,
		priority: config.priority,
		name,
		range,
		order,
		attributes,
	};
};

const rowWrap = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): LineAnnotation => {
	const config = rowWrapByName.get(name);
	if (!config) throw new Error(`Unknown rowWrap config: ${name}`);

	return {
		scope: "line",
		render: config.render,
		priority: config.priority,
		name,
		range,
		order,
		attributes,
	};
};

const rowClass = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): LineAnnotation => {
	const config = rowClassByName.get(name);
	if (!config) throw new Error(`Unknown rowClass config: ${name}`);

	return {
		scope: "line",
		class: config.class,
		priority: config.priority,
		name,
		range,
		order,
		attributes,
	};
};

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

describe("code-string converter", () => {
	it("code fence를 document로 변환할 때 lang/meta와 tag 기반 annotation을 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="hello.ts" showLineNumbers',
			value: [
				`// @line Callout {0-1} tone="info"`,
				`// @char Tooltip {0-6} content="tip"`,
				'console.log("hello")',
				`// @line diff {1-1}`,
				"return 1",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document).toEqual({
			lang: "ts",
			meta: { title: "hello.ts", showLineNumbers: true },
			annotations: [
				rowWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }]),
				rowClass("diff", { start: 1, end: 2 }, 1),
			],
			lines: [
				line('console.log("hello")', [
					charRender("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }]),
				]),
				line("return 1"),
			],
		});
	});

	it("document를 code fence로 변환할 때 tag와 order 순서를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "hello.ts", showLineNumbers: true },
			annotations: [rowWrap("Callout", { start: 0, end: 2 }, 0), rowClass("diff", { start: 1, end: 2 }, 1)],
			lines: [
				line('console.log("hello")', [
					charRender("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }]),
				]),
				line("return 1"),
			],
		};

		const codeNode = fromCodeBlockDocumentToCodeFence(input, annotationConfig);

		expect(codeNode.type).toBe("code");
		expect(codeNode.lang).toBe("ts");
		expect(codeNode.meta).toBe('title="hello.ts" showLineNumbers');
		expect(codeNode.value).toBe(
			[
				`// @line Callout {0-1}`,
				`// @char Tooltip {0-6} content="tip"`,
				'console.log("hello")',
				`// @line diff {1-1}`,
				"return 1",
			].join("\n"),
		);
	});

	it("동일 range wrapper의 order는 code string 라인 순서로 왕복 보존된다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @line Callout {0-0}`,
				`// @line Collapsible {0-0}`,
				`// @char Tooltip {0-4}`,
				`// @char u {0-4}`,
				"hello",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, annotationConfig);

		expect(document.annotations.map((annotation) => annotation.name)).toEqual(["Callout", "Collapsible"]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.name)).toEqual(["Tooltip", "u"]);
		expect(output.value).toBe(input.value);
	});

	it("document -> code -> document 라운드트립에서 lang/meta/annotations를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "roundtrip.ts", showLineNumbers: true },
			annotations: [
				rowWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }]),
				rowClass("diff", { start: 1, end: 2 }, 1),
			],
			lines: [
				line('const value = "hello"', [
					charRender("Tooltip", { start: 6, end: 11 }, 0, [{ name: "content", value: "tip" }]),
					charRender("u", { start: 14, end: 21 }, 1),
				]),
				line("return value"),
			],
		};

		const code = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const output = fromCodeFenceToCodeBlockDocument(code, annotationConfig);

		expect(output).toEqual(input);
	});

	it("code -> document -> code 라운드트립에서 canonical code fence를 보존한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="canon.ts" showLineNumbers',
			value: [
				`// @line Callout {0-1} tone="warn"`,
				`// @char Tooltip {6-10} content="tip"`,
				'const value = "hello"',
				`// @line diff {1-1}`,
				"return value",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, annotationConfig);

		expect(output).toEqual(input);
	});

	it("meta boolean이 false인 값은 직렬화 시 제외한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "meta.ts", showLineNumbers: false, collapsed: true },
			annotations: [],
			lines: [line("console.log('x')")],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const parsed = fromCodeFenceToCodeBlockDocument(output, annotationConfig);

		expect(output.meta).toBe('title="meta.ts" collapsed');
		expect(parsed.meta).toEqual({ title: "meta.ts", collapsed: true });
		expect(parsed.meta).not.toHaveProperty("showLineNumbers");
	});

	it("document -> code에서 annotation attribute를 JSON 표현으로 직렬화한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [
				rowWrap("Callout", { start: 0, end: 1 }, 0, [
					{ name: "open", value: true },
					{ name: "count", value: 2 },
					{ name: "meta", value: { a: 1 } },
					{ name: "items", value: [1, "x"] },
					{ name: "collapsed", value: null },
				]),
			],
			lines: [line("hello")],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const first = output.value.split("\n")[0];

		expect(first).toContain("open");
		expect(first).not.toContain("open=true");
		expect(first).toContain("count=2");
		expect(first).toContain('meta={"a":1}');
		expect(first).toContain('items=[1,"x"]');
		expect(first).toContain("collapsed=null");
	});

	it("document -> code에서 boolean attribute는 true면 key만, false면 생략한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [
				rowWrap("Callout", { start: 0, end: 1 }, 0, [
					{ name: "showLineNumbers", value: true },
					{ name: "collapsed", value: false },
					{ name: "count", value: 2 },
				]),
			],
			lines: [
				line("hello", [
					charRender("Tooltip", { start: 0, end: 5 }, 0, [
						{ name: "showLineNumbers", value: true },
						{ name: "collapsed", value: false },
					]),
				]),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const lines = output.value.split("\n");
		const rowWrapComment = lines[0] ?? "";
		const inlineComment = lines[1] ?? "";

		expect(rowWrapComment).toContain("showLineNumbers");
		expect(rowWrapComment).not.toContain("showLineNumbers=true");
		expect(rowWrapComment).not.toContain("collapsed");
		expect(rowWrapComment).toContain("count=2");

		expect(inlineComment).toContain("showLineNumbers");
		expect(inlineComment).not.toContain("showLineNumbers=true");
		expect(inlineComment).not.toContain("collapsed");
	});

	it("document -> code에서 annotation comment는 대상 코드 라인의 들여쓰기를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [rowWrap("Callout", { start: 1, end: 3 }, 0), rowClass("diff", { start: 2, end: 3 }, 1)],
			lines: [
				line("if (ok) {"),
				line("  const value = 1", [
					charRender("Tooltip", { start: 2, end: 7 }, 0, [{ name: "content", value: "tip" }]),
				]),
				line("    console.log(value)"),
				line("}"),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);

		expect(output.value).toBe(
			[
				"if (ok) {",
				`  // @line Callout {1-2}`,
				`  // @char Tooltip {2-6} content="tip"`,
				"  const value = 1",
				`    // @line diff {2-2}`,
				"    console.log(value)",
				"}",
			].join("\n"),
		);
	});

	it("code -> document에서 annotation attribute의 JSON 타입을 복원한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @line Callout {0-0} open=true count=2 meta={"a":1} items=[1,"x"] collapsed=null`,
				`// @char Tooltip {0-4} open=true count=2 meta={"a":1} items=[1,"x"] collapsed=null`,
				"hello",
			].join("\n"),
		};

		const output = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const rowWrapAttrs = output.annotations[0]?.attributes;
		const inlineAttrs = output.lines[0]?.annotations[0]?.attributes;

		expect(rowWrapAttrs).toEqual([
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
		expect(inlineAttrs).toEqual([
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
	});

	it("code -> document에서 boolean shorthand attribute를 true로 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [`// @line Callout {0-0} showLineNumbers`, `// @char Tooltip {0-4} showLineNumbers`, "hello"].join("\n"),
		};

		const output = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const rowWrapAttrs = output.annotations[0]?.attributes;
		const inlineAttrs = output.lines[0]?.annotations[0]?.attributes;

		expect(rowWrapAttrs).toEqual([{ name: "showLineNumbers", value: true }]);
		expect(inlineAttrs).toEqual([{ name: "showLineNumbers", value: true }]);
	});

	it("line marker 문법(@line name ... @line name end)으로 rowWrap range를 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @line Collapsible`,
				"line-1",
				`// @line Collapsible`,
				"line-2",
				`// @line Collapsible end`,
				"line-3",
				`// @line Collapsible end`,
				"line-4",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["line-1", "line-2", "line-3", "line-4"]);
		expect(document.annotations).toHaveLength(2);
		expect(document.annotations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "Collapsible", range: { start: 0, end: 3 } }),
				expect.objectContaining({ name: "Collapsible", range: { start: 1, end: 2 } }),
			]),
		);
	});

	it("line marker 문법은 미종료 rowWrap도 EOF까지 범위로 닫는다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: ["// @line Callout", "alpha", "beta", "gamma"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["alpha", "beta", "gamma"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				name: "Callout",
				range: { start: 0, end: 3 },
			}),
		]);
	});

	it("document scope inline annotation은 @document와 absolute range로 직렬화한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [],
			lines: [
				line('const x = "hello"', [
					{
						scope: "document",
						name: "fold",
						source: "mdx-text",
						render: "fold",
						priority: 2,
						order: 0,
						range: { start: 10, end: 15 },
						attributes: [],
					},
				]),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const lines = output.value.split("\n");
		const firstComment = lines[0] ?? "";

		expect(firstComment).toBe("// @document fold {10-14}");
	});
});

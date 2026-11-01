import { describe, expect, it } from "vitest";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationConfigItem,
	CodeFence as Code,
	CodeBlockDocument,
	InlineAnnotation,
	Line,
	LineAnnotation,
	Range,
} from "../types";

describe("code-string converter", () => {
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

	const charRender = (
		name: string,
		range: Range,
		order: number,
		attributes: AnnotationAttr[] = [],
	): InlineAnnotation => {
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

	it("FMT-R2 document -> code -> document round trip preserves lang/meta/annotations", () => {
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

	it("FMT-R2 when converting a meta boolean that is false, excludes it on serialization", () => {
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

	it("FMT-R2 document -> code serializes annotation attributes as JSON", () => {
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

	it("FMT-R2 document -> code writes only the key for a true boolean attribute and omits a false one", () => {
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

	it("FMT-R2 document -> code preserves the indentation of the target code line in the annotation comment", () => {
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

	it("FMT-R2 a document scope inline annotation serializes as @document with an absolute range", () => {
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

describe("inline absolute range", () => {
	const annotationConfig: AnnotationConfig = {
		annotations: [{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] }],
	};

	it("FMT-R2 when serializing a code fence, converts the inline absolute offset to a line-local range comment", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			lines: [
				{ value: "abcde", annotations: [] },
				{
					value: "vwxyz",
					annotations: [
						{
							scope: "char",
							source: "mdx-text",
							name: "Tooltip",
							range: { start: 7, end: 9 },
							priority: 0,
							order: 0,
						},
					],
				},
			],
			annotations: [],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const lines = output.value.split("\n");

		expect(lines[1]).toContain("@char Tooltip {1-2}");
	});
});

describe("regex rule preservation", () => {
	const annotationConfig: AnnotationConfig = {
		annotations: [{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] }],
	};

	const parse = (value: string) => {
		const codeNode: Code = {
			type: "code",
			lang: "tsx",
			meta: "",
			value,
		};

		return fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
	};

	it("FMT-R2 writes a `/` in a regex as `\\/` so the comment does not break", () => {
		const document = parse(["// @document fold {re:/x/}", "a/b/c"].join("\n"));
		const rule = document.rules?.[0];
		if (!rule) throw new Error("the comment was not read as a rule");
		// A pattern with a bare `/` next to one already escaped.
		const withSlash = { ...document, rules: [{ ...rule, pattern: "a/b\\/c" }] };
		const written = fromCodeBlockDocumentToCodeFence(withSlash, annotationConfig).value;
		expect(written.split("\n")[0]).toBe("// @document fold {re:/a\\/b\\/c/}");
		expect(parse(written).lines[0]?.annotations[0]?.range).toEqual({ start: 0, end: 5 });
	});

	it("FMT-R2 writes the rule as is when saved again", () => {
		const source = ["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n");
		expect(fromCodeBlockDocumentToCodeFence(parse(source), annotationConfig).value).toBe(source);
	});
});

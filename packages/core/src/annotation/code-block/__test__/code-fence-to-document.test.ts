import { describe, expect, it } from "vitest";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import type {
	AnnotationAttr,
	AnnotationConfig,
	AnnotationConfigItem,
	CodeFence as Code,
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

	it("FMT-R2 when converting a code fence to a document, parses lang/meta and tag-based annotations", () => {
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

	it("FMT-R2 the order of same-range wrappers survives a round trip via code string line order", () => {
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

	it("FMT-R2 code -> document -> code round trip preserves the canonical code fence", () => {
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

	it("FMT-R2 code -> document restores the JSON type of annotation attributes", () => {
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

	it("FMT-C1 parses a rowWrap range with line marker syntax (@line name ... @line name end)", () => {
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

	it("FMT-C1 line marker syntax closes an unterminated rowWrap as a range up to EOF too", () => {
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
});

describe("inline absolute range", () => {
	const annotationConfig: AnnotationConfig = {
		annotations: [{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] }],
	};

	it("FMT-R2 when parsing a code fence, stores the inline range as an absolute offset in the code block", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["abcde", "// @char Tooltip {1-2}", "vwxyz"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
		const annotation = document.lines[1]?.annotations[0];

		expect(annotation?.range).toEqual({ start: 7, end: 9 });
	});
});

describe("regex annotation comment syntax", () => {
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

	it("FMT-C1 @char fold regex applies only to the single code line right below", () => {
		const line = 'const value = "foo foo"';
		const nextLine = 'const tail = "foo"';
		const first = line.indexOf("foo");
		const second = line.indexOf("foo", first + 1);
		const document = parse(["// @char fold {re:/foo/g}", line, nextLine].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line, nextLine]);
		expect(document.lines[0]?.annotations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "char",
					name: "fold",
					render: "fold",
					range: { start: first, end: first + 3 },
				}),
				expect.objectContaining({
					scope: "char",
					name: "fold",
					render: "fold",
					range: { start: second, end: second + 3 },
				}),
			]),
		);
		expect(document.lines[1]?.annotations).toEqual([]);
	});

	it("FMT-C1 @document fold regex finds across the whole code block and stores it as an absolute range", () => {
		const firstLine = 'const a = <div className="alpha beta" />';
		const secondLine = 'const b = <span className="gamma" />';
		const firstCapture = "alpha beta";
		const secondCapture = "gamma";
		const document = parse(
			['// @document fold {re:/(?<=className\\s*=\\s*")[^"]+(?=")/g}', firstLine, secondLine].join("\n"),
		);

		expect(document.lines.map((item) => item.value)).toEqual([firstLine, secondLine]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: {
					start: firstLine.indexOf(firstCapture),
					end: firstLine.indexOf(firstCapture) + firstCapture.length,
				},
			}),
		]);

		const secondLineStart = firstLine.length + 1;
		expect(document.lines[1]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: {
					start: secondLineStart + secondLine.indexOf(secondCapture),
					end: secondLineStart + secondLine.indexOf(secondCapture) + secondCapture.length,
				},
			}),
		]);
	});

	it("FMT-C1 a document regex makes a range for every match even without the g flag", () => {
		const line = "foo bar foo";
		const document = parse(["// @document fold {re:/foo/}", line].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 0, end: 3 },
			}),
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 8, end: 11 },
			}),
		]);
	});

	it("FMT-C1 a document regex match spanning a line break is split into per-line absolute ranges", () => {
		const firstLine = "hello";
		const secondLine = "world";
		const document = parse([String.raw`// @document fold {re:/o\nw/g}`, firstLine, secondLine].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([firstLine, secondLine]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 4, end: 5 },
			}),
		]);
		expect(document.lines[1]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 6, end: 7 },
			}),
		]);
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

	it("FMT-R2 returns a regex selector as a rule, and attaches the rule index to the found ranges", () => {
		const document = parse(["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n"));
		expect(document.rules).toEqual([
			{ scope: "document", name: "fold", pattern: "b+", flags: "", attributes: [] },
			{ scope: "char", name: "fold", pattern: "a", flags: "g", line: 0, attributes: [{ name: "open", value: true }] },
		]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.rule)).toEqual([1, 1, 0]);
	});

	it("FMT-R2 also reads a `}` inside a regex as part of the selector", () => {
		const document = parse(["// @char fold {re:/a{2}[}]/}", "xaa}x"].join("\n"));
		expect(document.rules?.[0]).toMatchObject({ pattern: "a{2}[}]", line: 0 });
		expect(document.lines[0]?.annotations[0]?.range).toEqual({ start: 1, end: 4 });
	});

	it("FMT-R2 drops @char rules with no line to apply to and re-links the remaining rule indexes", () => {
		const document = parse(["// @document fold {re:/x/}", "x", "// @char fold {re:/y/}"].join("\n"));
		expect(document.rules?.map((rule) => rule.scope)).toEqual(["document"]);
		expect(document.lines[0]?.annotations[0]?.rule).toBe(0);
	});
});

describe("scope comment syntax", () => {
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

	it("FMT-C1 @line plus creates a line scope annotation on the 1 code line right below", () => {
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

	it("FMT-R2 @document fold {0-4} applies the closed range [0,4] as an absolute inline range", () => {
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

	it("FMT-C1 @document fold applies to the whole code block when there is no selector", () => {
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

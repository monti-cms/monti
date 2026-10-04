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
		{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
	],
};

const isCharRender = (item: AnnotationConfigItem): item is Extract<AnnotationConfigItem, { kind: "render" }> =>
	item.kind === "render" && (item.scopes ?? []).includes("char");
const isLineRender = (item: AnnotationConfigItem): item is Extract<AnnotationConfigItem, { kind: "render" }> =>
	item.kind === "render" && (item.scopes ?? []).includes("line");

const charRenderByName = new Map(
	(annotationConfig.annotations ?? [])
		.filter(isCharRender)
		.map((item, priority) => [item.name, { source: item.source ?? "mdx-text", render: item.render, priority }]),
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

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

describe("code-string converter comment syntax", () => {
	it("postcss의 /* */ 주석 annotation 라인을 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "postcss",
			meta: "",
			value: [
				`/* @line Callout {0-1} tone="info" */`,
				`/* @char Tooltip {0-4} content="tip" */`,
				"hello",
				"world",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document).toEqual({
			lang: "postcss",
			meta: {},
			annotations: [rowWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }])],
			lines: [
				line("hello", [charRender("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])]),
				line("world"),
			],
		});
	});

	it("postcss 직렬화 시 annotation 라인에 /* */ postfix를 유지한다", () => {
		const input: CodeBlockDocument = {
			lang: "postcss",
			meta: {},
			annotations: [rowWrap("Callout", { start: 0, end: 2 }, 0)],
			lines: [
				line("hello", [charRender("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])]),
				line("world"),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);

		expect(output.value).toBe(
			[`/* @line Callout {0-1} */`, `/* @char Tooltip {0-4} content="tip" */`, "hello", "world"].join("\n"),
		);
	});
});

import type { DecorationItem } from "shiki";
import { describe, expect, it } from "vitest";
import type { AnnotationConfig, CodeBlockDocument } from "../../../code-block";
import { fromCodeFenceToCodeBlockDocument } from "../../../code-block";
import * as remarkModule from "../remark-annotation-to-decoration";

type ComposePayloadResult = {
	code: string;
	lang: string;
	meta: Record<string, unknown>;
	decorations: DecorationItem[];
	lineDecorations: Array<{
		scope: "line";
		name: string;
		range: { start: number; end: number };
		class: string;
		order: number;
	}>;
	rowWrappers: Array<{
		scope: "line";
		name: string;
		range: { start: number; end: number };
		render: string;
		order: number;
		attributes?: { name: string; value: unknown }[];
	}>;
};

const fromCodeBlockDocumentToShikiAnnotationPayload = (
	remarkModule as unknown as {
		__testable__?: {
			fromCodeBlockDocumentToShikiAnnotationPayload?: (
				document: CodeBlockDocument,
				annotationConfig?: AnnotationConfig,
			) => ComposePayloadResult;
		};
	}
).__testable__?.fromCodeBlockDocumentToShikiAnnotationPayload;

const testAnnotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] },
		{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
		{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
		{ name: "plus", kind: "class", class: "plus", scopes: ["line"] },
		{ name: "minus", kind: "class", class: "minus", scopes: ["line"] },
		{ name: "highlight", kind: "class", class: "highlight", scopes: ["line"] },
	],
};

const isLinePosition = (value: DecorationItem["start"]): value is { line: number; character: number } =>
	typeof value === "object" && value !== null && "line" in value && "character" in value;

describe("fromCodeBlockDocumentToShikiAnnotationPayload", () => {
	it("document를 shiki payload(decorations/lineDecorations/rowWrappers)로 변환해야 한다", () => {
		if (typeof fromCodeBlockDocumentToShikiAnnotationPayload !== "function") {
			throw new Error("fromCodeBlockDocumentToShikiAnnotationPayload is not implemented");
		}

		const document = fromCodeFenceToCodeBlockDocument(
			{
				type: "code",
				lang: "ts",
				meta: 'title="demo.ts" showLineNumbers',
				value: [
					'// @char Tooltip {6-10} content="tip"',
					"const value = 1",
					'// @line Callout {0-1} variant="tip"',
					"// @line diff {1-1}",
					"const next = 2",
				].join("\n"),
			},
			testAnnotationConfig,
		);

		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, testAnnotationConfig);

		expect(payload.code).toBe("const value = 1\nconst next = 2");
		expect(payload.lang).toBe("ts");
		expect(payload.meta).toEqual({ title: "demo.ts", showLineNumbers: true });

		expect(payload.decorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					start: { line: 0, character: 6 },
					end: { line: 0, character: 11 },
					properties: {
						"data-anno-render": "Tooltip",
						"data-anno-content": '"tip"',
					},
				}),
			]),
		);

		expect(payload.lineDecorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "line",
					name: "diff",
					range: { start: 1, end: 2 },
					class: "diff",
					order: 1,
				}),
			]),
		);

		expect(payload.rowWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "line",
					name: "Callout",
					range: { start: 0, end: 2 },
					render: "Callout",
					order: 0,
					attributes: [{ name: "variant", value: "tip" }],
				}),
			]),
		);
	});

	it("document scope regex + 선행 빈 줄이 있어도 absolute range를 올바르게 line-local로 변환한다", () => {
		if (typeof fromCodeBlockDocumentToShikiAnnotationPayload !== "function") {
			throw new Error("fromCodeBlockDocumentToShikiAnnotationPayload is not implemented");
		}

		const document = fromCodeFenceToCodeBlockDocument(
			{
				type: "code",
				lang: "ts",
				meta: "",
				value: [
					"// @document fold {re:/console/g}",
					"",
					"// @line plus",
					"console.log",
					"// @line minus",
					"console.log",
					"// @line highlight",
					"console.log",
					"console.log",
				].join("\n"),
			},
			testAnnotationConfig,
		);

		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, testAnnotationConfig);
		const foldDecorationOnFirstConsoleLine = payload.decorations.find(
			(decoration) =>
				isLinePosition(decoration.start) &&
				isLinePosition(decoration.end) &&
				decoration.start.line === 1 &&
				decoration.end.line === 1 &&
				decoration.start.character === 0 &&
				decoration.end.character === 7,
		);

		expect(foldDecorationOnFirstConsoleLine).toBeDefined();
	});

	it("annotation에 class/render가 없어도 name+scope rule lookup으로 payload를 만든다", () => {
		if (typeof fromCodeBlockDocumentToShikiAnnotationPayload !== "function") {
			throw new Error("fromCodeBlockDocumentToShikiAnnotationPayload is not implemented");
		}

		const document: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			lines: [
				{
					value: "console.log(value)",
					annotations: [
						{
							scope: "char",
							name: "Tooltip",
							range: { start: 0, end: 7 },
							order: 0,
							priority: 0,
							source: "mdx-text",
							attributes: [{ name: "content", value: "tip" }],
						},
					],
				},
			],
			annotations: [
				{
					scope: "line",
					name: "diff",
					range: { start: 0, end: 1 },
					order: 0,
					priority: 0,
				},
				{
					scope: "line",
					name: "Callout",
					range: { start: 0, end: 1 },
					order: 1,
					priority: 0,
					attributes: [{ name: "variant", value: "tip" }],
				},
			],
		};

		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, testAnnotationConfig);

		expect(payload.decorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					properties: {
						"data-anno-render": "Tooltip",
						"data-anno-content": '"tip"',
					},
				}),
			]),
		);
		expect(payload.lineDecorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "line",
					name: "diff",
					class: "diff",
				}),
			]),
		);
		expect(payload.rowWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "line",
					name: "Callout",
					render: "Callout",
				}),
			]),
		);
	});
});

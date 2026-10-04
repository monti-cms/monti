import type { Code, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, it } from "vitest";
import { remarkAnnotationToShikiDecoration } from "../remark-annotation-to-decoration";

type AnnotationConfig = Parameters<typeof remarkAnnotationToShikiDecoration>[0];

const markOnlyConfig: AnnotationConfig = {
	annotations: [{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] }],
};

const decOnlyConfig: AnnotationConfig = {
	annotations: [{ name: "diff", kind: "class", source: "mdx-text", class: "diff", scopes: ["char"] }],
};

const fullConfig: AnnotationConfig = {
	annotations: [
		{ name: "diff", kind: "class", source: "mdx-text", class: "diff", scopes: ["char", "line"] },
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
	],
};

const getCodeNode = (root: Root) => root.children[0] as Code;
const getHProperties = (code: Code) =>
	((code.data as { hProperties?: unknown } | undefined)?.hProperties ?? {}) as Record<string, unknown>;

describe("remarkAnnotationToShikiDecoration", () => {
	it("mark annotation을 decoration으로 변환하고 annotation 라인을 제거한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: 'title="demo.ts" showLineNumbers',
					value: ['// @char Tooltip {0-4} content="tip"', "hello world"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));
		const renderTags = JSON.parse(String(hProperties["data-render-tags"] ?? "[]"));

		expect(code.value).toBe("hello world");
		expect(decorations).toHaveLength(1);
		expect(renderTags).toEqual(expect.arrayContaining(["Tooltip"]));
		expect(decorations[0]).toMatchObject({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 5 },
			properties: {
				"data-anno-render": "Tooltip",
				"data-anno-content": '"tip"',
			},
		});
	});

	it("python 같은 // 이외 주석 prefix에서도 annotation을 파싱해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "python",
					meta: "",
					value: ['# @char Tooltip {0-4} content="tip"', "print('hello')"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe("print('hello')");
		expect(decorations).toHaveLength(1);
	});

	it("postcss의 /* */ postfix 주석 annotation도 파싱해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "postcss",
					meta: "",
					value: ['/* @char Tooltip {0-4} content="tip" */', ".button {}"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe(".button {}");
		expect(decorations).toHaveLength(1);
		expect(decorations[0]).toMatchObject({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 5 },
		});
	});

	it("inline annotation은 inline class decoration으로 변환한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: ["// @char diff {0-4}", "hello world"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(decOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe("hello world");
		expect(decorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					start: { line: 0, character: 0 },
					end: { line: 0, character: 5 },
					properties: { class: "diff" },
				}),
			]),
		);
	});

	it("설정에 없는 annotation 라인은 코드 라인으로 보존한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: ["// @char Unknown {0-4}", "hello"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe(["// @char Unknown {0-4}", "hello"].join("\n"));
		expect(decorations).toEqual([]);
	});

	it("line/block annotation을 line-decorations / line-wrappers payload로 분리 보존해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: [
						'// @line Callout {0-1} variant="tip"',
						"// @line diff {1-1}",
						"const first = 1",
						"const second = 2",
					].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(fullConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const lineDecorations = JSON.parse(String(hProperties["data-line-decorations"] ?? "[]"));
		const rowWrappers = JSON.parse(String(hProperties["data-line-wrappers"] ?? "[]"));

		expect(code.value).toBe(["const first = 1", "const second = 2"].join("\n"));
		expect(rowWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Callout",
					range: { start: 0, end: 2 },
					attributes: [{ name: "variant", value: "tip" }],
				}),
			]),
		);
		expect(lineDecorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "diff",
					range: { start: 1, end: 2 },
				}),
			]),
		);
	});

	it("실제 markdown code fence를 파싱한 mdast에서도 동일하게 동작해야 한다", () => {
		const markdown = ['```ts title="demo.ts"', '// @line Callout {0-0} variant="tip"', "const a = 1", "```"].join("\n");
		const root = fromMarkdown(markdown) as Root;

		remarkAnnotationToShikiDecoration(fullConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const rowWrappers = JSON.parse(String(hProperties["data-line-wrappers"] ?? "[]"));

		expect(code.lang).toBe("ts");
		expect(code.meta).toBe('title="demo.ts"');
		expect(code.value).toBe("const a = 1");
		expect(rowWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Callout",
					range: { start: 0, end: 1 },
					render: "Callout",
				}),
			]),
		);
	});
});

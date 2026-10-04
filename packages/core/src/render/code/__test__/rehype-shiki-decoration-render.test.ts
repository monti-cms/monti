import type { Element, Root } from "hast";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../code-highlighter", () => ({
	highlight: vi.fn(),
}));

import { highlight } from "../code-highlighter";
import { rehypeShikiDecorationRender } from "../rehype-shiki-decoration-render";

const highlightMock = vi.mocked(highlight);

const createTree = (pre: Element): Root => ({
	type: "root",
	children: [pre],
});

const createPreWithCode = ({
	codeValue,
	codeClassName = ["language-ts"],
	preData = {},
	codeData = {},
}: {
	codeValue: string;
	codeClassName?: Array<string>;
	preData?: Element["properties"];
	codeData?: Element["properties"];
}): Element => ({
	type: "element",
	tagName: "pre",
	properties: preData,
	children: [
		{
			type: "element",
			tagName: "code",
			properties: {
				className: codeClassName,
				...codeData,
			},
			children: [{ type: "text", value: codeValue }],
		},
	],
});

describe("rehypeShikiDecorationRender", () => {
	beforeEach(() => {
		highlightMock.mockReset();
	});

	it("parses the data-* payload of pre/code, passes it to highlight and replaces the pre", async () => {
		const renderedPre: Element = {
			type: "element",
			tagName: "pre",
			properties: { "data-rendered": true },
			children: [],
		};
		highlightMock.mockReturnValue({
			type: "root",
			children: [renderedPre],
		});

		const pre = createPreWithCode({
			codeValue: "const a = 1;\n",
			preData: {
				"data-meta": '{"title":"demo.ts"}',
				"data-decorations":
					'[{"start":{"line":0,"character":0},"end":{"line":0,"character":5},"properties":{"class":"diff"}}]',
				"data-line-decorations": '[{"scope":"line","name":"diff","range":{"start":0,"end":1},"class":"diff"}]',
				"data-line-wrappers":
					'[{"scope":"line","name":"Callout","range":{"start":0,"end":1},"order":0,"render":"Callout","attributes":[{"name":"variant","value":"tip"}]}]',
				"data-render-tags": '["Tooltip","Callout"]',
			},
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).toHaveBeenCalledTimes(1);
		expect(highlightMock).toHaveBeenCalledWith(
			"const a = 1;",
			"ts",
			{ title: "demo.ts" },
			{
				decorations: [
					{
						start: { line: 0, character: 0 },
						end: { line: 0, character: 5 },
						properties: { class: "diff" },
					},
				],
				lineDecorations: [{ scope: "line", name: "diff", range: { start: 0, end: 1 }, class: "diff" }],
				rowWrappers: [
					{
						scope: "line",
						name: "Callout",
						range: { start: 0, end: 1 },
						order: 0,
						render: "Callout",
						attributes: [{ name: "variant", value: "tip" }],
					},
				],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);
		expect(tree.children[0]).toBe(renderedPre);
	});

	it("falls back to the data-* of code when pre has no data", async () => {
		const renderedPre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};
		highlightMock.mockReturnValue({
			type: "root",
			children: [renderedPre],
		});

		const pre = createPreWithCode({
			codeValue: "print('hello')\n",
			codeClassName: ["language-python"],
			codeData: {
				"data-meta": '{"showLineNumbers":true}',
				"data-decorations": "[]",
				"data-line-decorations": "[]",
				"data-line-wrappers": "[]",
				"data-render-tags": '["Tooltip","Callout"]',
			},
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).toHaveBeenCalledWith(
			"print('hello')",
			"python",
			{ showLineNumbers: true },
			{
				decorations: [],
				lineDecorations: [],
				rowWrappers: [],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);
	});

	it("skips when there is no code child", async () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "element",
					tagName: "pre",
					properties: {},
					children: [{ type: "text", value: "no code child" }],
				},
			],
		};

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).not.toHaveBeenCalled();
	});

	it("highlights the mermaid lang by default too", async () => {
		const renderedPre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};
		highlightMock.mockReturnValue({
			type: "root",
			children: [renderedPre],
		});

		const pre = createPreWithCode({
			codeValue: "graph TD;\nA-->B;\n",
			codeClassName: ["language-mermaid"],
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).toHaveBeenCalledTimes(1);
		expect(highlightMock).toHaveBeenCalledWith(
			"graph TD;\nA-->B;",
			"mermaid",
			{},
			{
				decorations: [],
				lineDecorations: [],
				rowWrappers: [],
				allowedRenderTags: [],
			},
		);
	});

	it("the skip condition can be customized with the ignoreLang option", async () => {
		const pre = createPreWithCode({
			codeValue: "const a = 1;\n",
			codeClassName: ["language-ts"],
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender({
			ignoreLang: (lang) => lang === "ts",
		})(tree);

		expect(highlightMock).not.toHaveBeenCalled();
	});
});

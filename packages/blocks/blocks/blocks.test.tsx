import { type Block, checkDoc, createBlockKit, type Doc } from "@monti-cms/core";
import { renderDocument } from "@monti-cms/core/render";
import { readMarkdown, toMdx } from "@monti-cms/mdx";
import { createElement, type ElementType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blocks, marks } from "./index";

const kit = createBlockKit(blocks, marks);
const doc = (...list: Block[]): Doc => ({ type: "doc", blocks: list });
let next = 0;
const id = () => `b_${++next}`;
const p = (text: string): Block => ({ id: id(), type: "paragraph", content: [{ type: "text", text }] });
const code = (title: string, text: string, language = "ts"): Block => ({
	id: id(),
	type: "codeBlock",
	attrs: { language, title },
	...(text ? { content: [{ type: "text", text }] } : {}),
});
const table = (rows: string[][]): Block => ({ id: id(), type: "table", attrs: { header: true, rows } });
/** React's `createElement` in the shape the core's drawing asks for, as a site hands it in. */
const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) =>
	createElement(type as ElementType, props, ...(children as ReactNode[]));
const html = (body: Doc, locale?: string) =>
	renderToStaticMarkup(
		createElement("div", null, ...renderDocument(body, { createElement: h, blocks, marks, locale })),
	);
const tasks = (block: Block) => kit.blocks.get(block.type)?.check?.(block) ?? [];

/** One of each, with the values a person gives them. */
const sample = () =>
	doc(
		{
			id: id(),
			type: "callout",
			attrs: { tone: "warning", title: "알아 두세요" },
			children: [p("React 19 기준이다.")],
		},
		{
			id: id(),
			type: "tabs",
			children: [
				{ id: id(), type: "tab", attrs: { label: "npm" }, children: [p("npm i monti")] },
				{ id: id(), type: "tab", attrs: { label: "pnpm" }, children: [p("pnpm add monti")] },
			],
		},
		{
			id: id(),
			type: "columns",
			attrs: { widths: "60,40" },
			children: [
				{ id: id(), type: "column", children: [p("전")] },
				{ id: id(), type: "column", children: [p("뒤")] },
			],
		},
		{ id: id(), type: "collapsible", attrs: { title: "자세히", defaultOpen: true }, children: [p("안")] },
		{
			id: id(),
			type: "codeExplorer",
			attrs: { open: "src/db.ts" },
			children: [code("src/app.ts", "import { db } from './db';"), code("src/db.ts", "export const db = 1;")],
		},
		{ id: id(), type: "math", attrs: { source: "a^2 + b^2 = c^2" } },
		{ id: id(), type: "mermaid", attrs: { source: "flowchart LR\n  A --> B" } },
		{
			id: id(),
			type: "chart",
			attrs: { kind: "line", title: "방문" },
			children: [
				table([
					["월", "방문"],
					["1월", "1200"],
					["2월", "1,850"],
				]),
			],
		},
		{
			id: id(),
			type: "paragraph",
			content: [
				{ type: "text", text: "빨간", marks: [{ type: "color", color: "red" }] },
				{ type: "text", text: " " },
				{ type: "text", text: "RSC", marks: [{ type: "tooltip", text: "React Server Components" }] },
			],
		},
	);

describe("the blocks' values (doc 18)", () => {
	it("18-2 every block and mark of the package passes the core's check with the values a person gives them", () => {
		expect(checkDoc(sample(), kit, null)).toEqual([]);
	});

	it("18-2 a value a block does not take is refused: a sixth callout kind, a colour by its code, a tab outside tabs", () => {
		const problems = checkDoc(
			doc(
				{ id: "x1", type: "callout", attrs: { tone: "important" }, children: [p("a")] },
				{
					id: "x2",
					type: "paragraph",
					content: [{ type: "text", text: "a", marks: [{ type: "color", color: "#ff0000" }] }],
				},
				{ id: "x3", type: "tabs", children: [p("not a tab")] },
			),
			kit,
			null,
		);
		expect(problems.map((problem) => [problem.block, problem.code])).toEqual([
			["x1", "badAttrs"],
			["x2", "badMark"],
			["x3", "badChild"],
		]);
	});

	it("18-6 a formula that does not read, a chart cell that is not a number, a tab with no name and two files on one path are publish to-dos that only tell", () => {
		expect(tasks({ id: "m", type: "math", attrs: { source: "\\frac{1}{" } })).toEqual([
			{ level: "warn", message: { ko: "읽지 못한 수식", en: "A formula that does not read" } },
		]);
		expect(tasks({ id: "m", type: "math", attrs: { source: "\\frac{1}{2}" } })).toEqual([]);
		const numbers = (cell: string): Block => ({
			id: "c",
			type: "chart",
			children: [
				table([
					["월", "방문"],
					["1월", cell],
				]),
			],
		});
		expect(tasks(numbers("많음")).map((row) => row.level)).toEqual(["warn"]);
		expect(tasks(numbers("12.5%"))).toEqual([]);
		expect(tasks(numbers(""))).toEqual([]);
		expect(
			tasks({ id: "t", type: "tabs", children: [{ id: "u", type: "tab", attrs: { label: " " }, children: [p("a")] }] }),
		).toHaveLength(1);
		expect(
			tasks({ id: "e", type: "codeExplorer", children: [code("src/a.ts", "1"), code("./src/a.ts", "2")] }),
		).toEqual([{ level: "warn", message: { ko: "경로가 겹치는 파일", en: "Files with the same path" } }]);
	});
});

describe("the blocks on the site (doc 18)", () => {
	it("18-2 a callout is titled by its title, or by its kind in the entry's language; an unknown kind is a note", () => {
		const titled = html(
			doc({ id: "a", type: "callout", attrs: { tone: "warning", title: "알아 두세요" }, children: [p("본문")] }),
		);
		expect(titled).toContain('data-tone="warning"');
		expect(titled).toContain(">알아 두세요<");
		expect(titled).toContain("본문");
		expect(html(doc({ id: "a", type: "callout", attrs: { tone: "tip" }, children: [] }), "ko-KR")).toContain(">팁<");
		const untold = html(doc({ id: "a", type: "callout", attrs: { tone: "odd" }, children: [] }));
		expect(untold).toContain('data-tone="note"');
		expect(untold).toContain(">Note<");
		expect(untold).not.toContain("monti-block-callout-body");
	});

	it("18-2 tabs keep every panel in the page, the first shown unless defaultValue names another", () => {
		const out = html(sample());
		expect(out).toContain('role="tablist"');
		expect(out).toContain("npm i monti");
		expect(out).toContain("pnpm add monti");
		expect(out.match(/role="tabpanel"[^>]*hidden/g)).toHaveLength(1);
		const second = html(
			doc({
				id: "t",
				type: "tabs",
				attrs: { defaultValue: "pnpm" },
				children: [
					{ id: "u", type: "tab", attrs: { label: "npm" }, children: [p("A")] },
					{ id: "v", type: "tab", attrs: { label: "pnpm" }, children: [p("B")] },
				],
			}),
		);
		expect(second).toMatch(/aria-selected="true"[^>]*>pnpm</);
	});

	it("18-2 columns are as wide as widths say, and equal when widths does not fit their number", () => {
		expect(html(sample())).toContain("--monti-columns:minmax(0, 60fr) minmax(0, 40fr)");
		const odd = html(
			doc({
				id: "c",
				type: "columns",
				attrs: { widths: "60,40,10" },
				children: [
					{ id: "d", type: "column", children: [p("a")] },
					{ id: "e", type: "column", children: [p("b")] },
				],
			}),
		);
		expect(odd).toContain("--monti-columns:repeat(2, minmax(0, 1fr))");
	});

	it("18-2 a collapsible is a details element, open when defaultOpen, titled by its own words when it has no title", () => {
		expect(html(sample())).toContain(
			'<details class="monti-block-collapsible" open=""><summary class="monti-block-collapsible-summary">자세히</summary>',
		);
		expect(html(doc({ id: "c", type: "collapsible", children: [p("a")] }), "ko")).toContain(
			'<details class="monti-block-collapsible"><summary class="monti-block-collapsible-summary">펼치기</summary>',
		);
	});

	it("18-2 a code explorer builds its tree from the paths, shows the open file first and keeps every file's code in the page", () => {
		const out = html(sample());
		expect(out).toContain('role="tree"');
		expect(out).toContain('data-path="src"');
		expect(out).toContain("import { db } from &#x27;./db&#x27;;");
		expect(out).toContain("export const db = 1;");
		// The file open first is db.ts: app.ts's panel is the hidden one.
		expect(out).toMatch(/data-code-explorer-panel="0" hidden/);
		expect(out).not.toMatch(/data-code-explorer-panel="1" hidden/);
		// A second file on a taken path is not lost: it is drawn after the explorer.
		const twice = html(
			doc({ id: "e", type: "codeExplorer", children: [code("a.ts", "first"), code("a.ts", "second")] }),
		);
		expect(twice).toContain("first");
		expect(twice).toContain("second");
	});

	it("18-2 a formula is drawn on the server; one that does not read is its source with the reason", () => {
		expect(html(sample())).toContain('class="katex-display"');
		const bad = html(doc({ id: "m", type: "math", attrs: { source: "\\frac{1}{" } }));
		expect(bad).toContain('data-state="error"');
		expect(bad).toContain("\\frac{1}{");
	});

	it("18-2 a diagram is its source in the page until the browser draws it", () => {
		expect(html(sample())).toContain(
			'<pre class="monti-block-mermaid-source"><code>flowchart LR\n  A --&gt; B</code></pre>',
		);
	});

	it("18-2 a chart is drawn from its table as SVG, the table kept under it; a pie draws the first series", () => {
		const out = html(sample());
		expect(out).toContain(
			'<figure class="monti-block-chart" data-kind="line"><figcaption class="monti-block-chart-title">방문</figcaption>',
		);
		expect(out).toMatch(/<svg[^>]*role="img"[^>]*aria-label="방문"/);
		expect(out).toContain('<path d="M');
		expect(out).toContain('<details class="monti-block-chart-data"><summary>See the data</summary><table>');
		const pie = html(
			doc({
				id: "c",
				type: "chart",
				attrs: { kind: "pie" },
				children: [
					table([
						["언어", "글"],
						["TS", "3"],
						["Go", "1"],
					]),
				],
			}),
		);
		expect(pie.match(/<path d="M320,160 L/g)).toHaveLength(2);
		expect(pie).toContain("<title>TS: 3</title>");
	});

	it("18-2 a tooltip and a colour are marks on the words: a note in the page, a colour by its name", () => {
		const out = html(sample());
		expect(out).toContain('<span class="monti-color" data-color="red">빨간</span>');
		expect(out).toContain('role="tooltip" class="monti-block-tooltip-content">React Server Components</span>');
	});
});

describe("the blocks as MDX (doc 18)", () => {
	const known = (type: string) => (type === "listItem" ? null : (kit.blocks.get(type)?.holds ?? null));
	const fences = Object.fromEntries(
		blocks.flatMap((block) => (block.fence ? [[block.type, block.fence]] : [])),
	) as Record<string, { language: string; attr: string }>;
	const fenced = (language: string) => {
		const found = blocks.find((block) => block.fence?.language === language);
		return found?.fence ? { type: found.type, attr: found.fence.attr } : null;
	};
	const site = { known, fenced, marks: (name: string) => name === "color" || name === "tooltip" };
	const bare = (list: Block[]): unknown[] =>
		list.map(({ id: _id, children, ...block }) => ({ ...block, ...(children ? { children: bare(children) } : {}) }));

	it("18-3 every block and mark of the package is written as MDX and read back as the same body", () => {
		const body = sample();
		const written = toMdx(body, { fences });
		expect(written).toContain(':::callout{tone="warning" title="알아 두세요"}');
		expect(written).toContain('::::tabs\n:::tab{label="npm"}');
		expect(written).toContain("```math\na^2 + b^2 = c^2\n```");
		expect(written).toContain("```mermaid\nflowchart LR");
		expect(written).toContain('```ts title="src/app.ts"');
		expect(written).toContain(':color[빨간]{color="red"}');
		expect(bare(readMarkdown(written, site).doc.blocks)).toEqual(bare(body.blocks));
	});
});

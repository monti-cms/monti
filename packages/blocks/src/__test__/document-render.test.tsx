import { STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { type RenderDocumentOptions, renderDocument } from "@monti-cms/core/render";
import { bodyFromMdx } from "@monti-cms/mdx/format";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderSite as site } from "../test/render-config";

type Doc = Parameters<typeof renderDocument>[0];
type Node = Doc["content"][number];

const doc = (...content: Node[]): Doc => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });
const text = (value: string, marks?: Node["marks"]): Node => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});
const paragraph = (...content: Node[]): Node => ({ type: "paragraph", content });

const html = async (stored: Doc, options: Omit<RenderDocumentOptions, "site"> = {}) => {
	const rendered = await renderDocument(stored, { site, ...options });
	expect(rendered.unknown).toEqual([]);
	return renderToStaticMarkup(rendered.content as ReactNode);
};

const fromMdx = (source: string): Doc => {
	const body = bodyFromMdx(site, source, [directiveSyntax()]);
	if (!body.doc) throw new Error("not a document");
	return body.doc;
};

/** The block extensions draw a stored document by themselves (`documentComponents` of each extension's render module), without compiling MDX. */
describe("block extension components of the JSON renderer", () => {
	it("draws a callout from its stored attributes, and the title and body follow the language", async () => {
		const callout = (attrs: Record<string, string>, content: Node[]): Node => ({ type: "callout", attrs, content });
		const markup = await html(
			doc(callout({ variant: "warning", title: "주의" }, [paragraph(text("본문", [{ type: "bold" }]))])),
		);
		expect(markup).toContain('class="cms-block-callout"');
		expect(markup).toContain('data-variant="warning"');
		expect(markup).toContain('<div class="cms-block-callout-title">주의</div>');
		expect(markup).toContain("<strong>본문</strong>");

		expect(await html(doc(callout({ variant: "tip" }, [paragraph(text("내용"))])), { locale: "ko" })).toContain(
			">팁</div>",
		);
		expect(await html(doc(callout({}, [paragraph(text("내용"))])), { locale: "en" })).toContain(">Note</div>");
		// A choice that is not one of the variants is the default, and a callout with no body has no body slot.
		const unknown = await html(doc(callout({ variant: "nope", title: "제목만" }, [])));
		expect(unknown).toContain('data-variant="note"');
		expect(unknown).not.toContain("cms-block-callout-body");
		// The empty paragraph the editor leaves in an empty container is not a body either.
		expect(await html(doc(callout({ title: "제목만" }, [{ type: "paragraph", content: [] }])))).not.toContain(
			"cms-block-callout-body",
		);
	});

	it("draws a collapsible with its default title and its open state", async () => {
		const collapsible = (attrs: Record<string, string | boolean>): Node => ({
			type: "collapsible",
			attrs,
			content: [paragraph(text("숨은 내용"))],
		});
		const open = await html(doc(collapsible({ title: "더 보기", defaultOpen: true })));
		expect(open).toContain("<details");
		expect(open).toContain(" open");
		expect(open).toContain('<summary class="cms-block-collapsible-summary">더 보기</summary>');
		const closed = await html(doc(collapsible({})), { locale: "ko" });
		expect(closed).not.toContain(" open");
		expect(closed).toContain(">펼치기</summary>");
	});

	it("draws tabs from the stored tabs: the names are their labels, the panels their content, and the default is a name", async () => {
		const tab = (label: string, ...content: Node[]): Node => ({ type: "tab", attrs: { label }, content });
		const tabs = (attrs: Record<string, string>, ...content: Node[]): Node => ({ type: "tabs", attrs, content });
		const markup = await html(
			doc(
				tabs(
					{ defaultValue: "둘째" },
					tab("첫째", paragraph(text("첫 내용"))),
					tab("둘째", paragraph(text("둘째 내용"))),
				),
			),
		);
		expect(markup).toContain('role="tablist"');
		expect(markup.match(/role="tab"/g)).toHaveLength(2);
		expect(markup.match(/role="tabpanel"/g)).toHaveLength(2);
		expect(markup).toMatch(/aria-selected="false"[^>]*>첫째/);
		expect(markup).toMatch(/aria-selected="true"[^>]*>둘째/);
		expect(markup).toMatch(/hidden=""[^>]*><p>첫 내용<\/p>/);
		expect(markup).toMatch(/role="tabpanel"[^>]*><p>둘째 내용<\/p>/);
		// A name that matches no tab opens the first tab; the tab itself adds no wrapper of its own inside the panel.
		const fallback = await html(
			doc(tabs({ defaultValue: "없음" }, tab("a", paragraph(text("A"))), tab("b", paragraph(text("B"))))),
		);
		expect(fallback).toMatch(/aria-selected="true"[^>]*>a/);
		expect(fallback).not.toContain('cms-block-tabs-panel"><div');
	});

	it("draws columns from the stored columns, and the widths follow the column count", async () => {
		const column = (...content: Node[]): Node => ({ type: "column", content });
		const columns = (attrs: Record<string, string>, ...content: Node[]): Node => ({ type: "columns", attrs, content });
		const two = await html(
			doc(columns({ widths: "60,40" }, column(paragraph(text("왼쪽"))), column(paragraph(text("오른쪽"))))),
		);
		expect(two).toContain("--cms-columns:minmax(0, 60fr) minmax(0, 40fr)");
		expect(two.match(/class="cms-block-column"/g)).toHaveLength(2);
		const mismatch = await html(
			doc(columns({ widths: "60,40,10" }, column(paragraph(text("a"))), column(paragraph(text("b"))))),
		);
		expect(mismatch).toContain("--cms-columns:repeat(2, minmax(0, 1fr))");
	});

	it("draws a code explorer from the stored code blocks: the tree from their titles and the code of the picked file", async () => {
		const file = (title: string, code: string): Node => ({
			type: "codeBlock",
			attrs: { language: "ts", meta: `title="${title}"`, code },
		});
		const explorer = (attrs: Record<string, string>, ...content: Node[]): Node => ({
			type: "code-explorer",
			attrs,
			content,
		});
		const markup = await html(
			doc(
				explorer(
					{ open: "src/b.ts" },
					file("src/a.ts", "const a = 1;"),
					file("src/b.ts", "const b = 2;"),
					file("public/", ""),
					paragraph(text("뒤 문단")),
				),
			),
		);
		expect(markup).toContain("const");
		// Every file's code block is in the page; the explorer keeps one of them visible. The paragraph that is not a file comes after it.
		expect(markup.match(/class="cms-code"/g)).toHaveLength(2);
		expect(markup).toContain("<p>뒤 문단</p>");
		expect(markup).toContain("src");
		// With no file that has a path the children are shown as they are.
		const plain = await html(
			doc(explorer({}, { type: "codeBlock", attrs: { language: "ts", meta: "", code: "const x = 1;" } })),
		);
		expect(plain).toContain('class="cms-code"');
		expect(plain).not.toContain('role="tree"');
	});

	it("draws the marks: tooltip, code link and text color", async () => {
		const markup = await html(
			doc(
				paragraph(
					text("툴팁", [{ type: "tooltip", attrs: { content: "설명" } }]),
					text(" "),
					text("함수", [{ type: "code-ref", attrs: { to: "c1" } }]),
					text(" "),
					text("색", [{ type: "color", attrs: { fg: "#dc2626", fgDark: "#f87171", bg: "red" } }]),
				),
			),
		);
		expect(markup).toContain('class="cms-block-tooltip-content">설명</span>');
		expect(markup).toContain('data-code-ref="c1"');
		expect(markup).toContain('class="cms-color" style="--cms-fg:#dc2626;--cms-fg-dark:#f87171" data-fg=""');
		// A value that is not a hex color is dropped.
		expect(markup).not.toContain("red");
	});

	it("draws the tooltip inside a code block, numbered, as the MDX renderer did", async () => {
		const markup = await html(fromMdx('```ts\n// @char Tooltip {0-5} content="코드 설명"\nconst a = 1;\n```'));
		expect(markup).toContain('class="cms-block-tooltip-content">코드 설명</span>');
		expect(markup).toContain('class="cms-code-notes"');
	});

	it("draws Mermaid and chart code fences from the source", async () => {
		const fence = (language: string, code: string): Node => ({
			type: "codeBlock",
			attrs: { language, meta: "", code },
		});
		expect(await html(doc(fence("mermaid", "graph TD\n  A --> B")))).toContain("graph TD");
		const chart = await html(
			doc(fence("chart", "chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200")),
		);
		expect(chart).not.toContain('role="alert"');
		const broken = await html(doc(fence("chart", "not a chart")), { locale: "en" });
		expect(broken).toContain('role="alert"');
	});

	it("lets the site override a block extension's component", async () => {
		const stored = doc({
			type: "callout",
			attrs: { variant: "tip", title: "제목" },
			content: [paragraph(text("본문"))],
		});
		const markup = await html(stored, {
			components: {
				blocks: {
					callout: ({ variant, title, children }) => (
						<aside data-tone={variant} title={title}>
							{children}
						</aside>
					),
				},
			},
		});
		expect(markup).toBe('<aside data-tone="tip" title="제목"><p>본문</p></aside>');
	});

	it("renders every block of the extension with nothing left to the fallback, in strict mode", async () => {
		const source = [
			':::callout{variant="info" title="a"}\nb\n:::',
			':::collapsible{title="c"}\nd\n:::',
			'::::tabs\n:::tab{label="e"}\nf\n:::\n:::tab{label="g"}\nh\n:::\n::::',
			":::::columns\n::::column\ni\n::::\n::::column\nj\n::::\n:::::",
			':::code-explorer\n```ts title="x.ts"\nconst x = 1;\n```\n:::',
			"```mermaid\ngraph TD\n  A --> B\n```",
			"```chart\nchart bar\nx a\nseries v | v | chart-1\n\ndata\na | v\n1 | 2\n```",
			':tooltip[t]{content="c"} :code-ref[r]{to="c1"} :color[x]{fg="#dc2626"}',
		].join("\n\n");
		await expect(renderDocument(fromMdx(source), { site, strict: true })).resolves.toBeDefined();
	});
});

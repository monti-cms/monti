import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import { storedCodeBlockAttrs } from "../../doc/stored-code-block";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { resetMissingComponentWarnings } from "../document/render";
import {
	CmsContent,
	type CodeBlockProps,
	type DocumentComponents,
	type FileProps,
	type FootnotesProps,
	type HeadingProps,
	type ImageProps,
	type LinkProps,
	type ListProps,
	type LooseDocumentComponents,
	mergeDocumentComponents,
	type RenderContext,
	renderDocument,
	type TableCellProps,
	type TableProps,
	tableOfContents,
	type UnknownProps,
} from "../index";

const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });
const text = (value: string, marks?: CmsNode["marks"]): CmsNode => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});
const paragraph = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });
const heading = (level: number, value: string): CmsNode => ({
	type: "heading",
	attrs: { level },
	content: [text(value)],
});
type RenderOptions = Omit<Parameters<typeof renderDocument>[1], "site">;
const html = async (stored: StoredDocument, options: RenderOptions = {}) =>
	renderToStaticMarkup((await renderDocument(stored, { site: testSite, ...options })).content as ReactNode);

/** Components for any config: the table is loosely typed here, as the test sites have different blocks. */
const loose = (components: LooseDocumentComponents) => components as unknown as DocumentComponents;

/** A code block as the stored document keeps it: the fence text (with the annotation comments) read into the code and its annotations. */
const codeBlock = (language: string, meta: string, value: string): CmsNode => ({
	type: "codeBlock",
	attrs: storedCodeBlockAttrs(testSite, { language, meta, value }),
});
const footnoteDoc = (): StoredDocument =>
	doc(heading(2, "제목"), paragraph(text("본문"), { type: "footnoteReference", attrs: { label: "1" } }), {
		type: "footnoteDefinition",
		attrs: { label: "1" },
		content: [paragraph(text("각주"))],
	});

describe("renderDocument: the result", () => {
	it("returns the content, the table of contents and the unknown nodes", async () => {
		const rendered = await renderDocument(doc(heading(2, "제목"), paragraph(text("본문"))), { site: testSite });
		expect(renderToStaticMarkup(rendered.content as ReactNode)).toContain('<h2 id="제목">');
		expect(rendered.toc).toEqual([{ value: "제목", id: "제목", href: "#제목", level: 2, depth: 0 }]);
		expect(rendered.unknown).toEqual([]);
	});

	it("renders a server component with CmsContent", async () => {
		const stored = doc(paragraph(text("안녕")));
		const element = await CmsContent({ cms: { site: testSite }, doc: stored });
		expect(renderToStaticMarkup(element as ReactNode)).toBe("<p>안녕</p>");
	});

	it("renders an empty body for something that is not a stored document, and never throws", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			for (const value of [
				null,
				{},
				{ type: "doc", version: 99, content: [] },
				{ type: "doc", version: 2, content: [1] },
			]) {
				const rendered = await renderDocument(value as never, { site: testSite });
				expect(rendered).toEqual({ content: null, toc: [], unknown: [] });
			}
			expect(error).toHaveBeenCalled();
		} finally {
			error.mockRestore();
		}
	});

	it("lifts an older document version before it renders", async () => {
		const old = {
			type: "doc",
			version: 1,
			content: [{ type: "codeBlock", attrs: { language: "ts", meta: "", value: "const a = 1;" } }],
		};
		expect(await html(old as never)).toContain('class="shiki');
	});

	it("renders without compiling MDX: it is a pure function of the stored document", async () => {
		const stored = docOf("## 제목\n\n본문 **굵게**\n\n```ts\nconst a = 1;\n```");
		const first = await html(stored);
		const second = await html(JSON.parse(JSON.stringify(stored)) as StoredDocument);
		expect(second).toBe(first);
	});
});

describe("heading anchors and the table of contents", () => {
	const stored = doc(
		heading(1, "제목"),
		heading(2, "개요"),
		heading(3, "개요"),
		heading(4, "깊은 곳"),
		heading(2, "개요"),
		{ type: "bulletList", content: [{ type: "listItem", content: [heading(2, "목록 안")] }] },
	);

	it("gives repeated headings -1, -2 in document order, as rehype-slug did", async () => {
		const markup = await html(stored);
		expect(markup.match(/<h\d id="[^"]*"/g)).toEqual([
			'<h1 id="제목"',
			'<h2 id="개요"',
			'<h3 id="개요-1"',
			'<h4 id="깊은-곳"',
			'<h2 id="개요-2"',
			'<h2 id="목록-안"',
		]);
	});

	it("lists levels 2 and 3 by default, counted from the first level", async () => {
		const { toc } = await renderDocument(stored, { site: testSite });
		expect(toc.map(({ value, id, level, depth }) => [value, id, level, depth])).toEqual([
			["개요", "개요", 2, 0],
			["개요", "개요-1", 3, 1],
			["개요", "개요-2", 2, 0],
			["목록 안", "목록-안", 2, 0],
		]);
		expect(toc.map((item) => item.href)).toEqual(toc.map((item) => `#${item.id}`));
	});

	it("tableOfContents is the same list without React, for any range", () => {
		expect(tableOfContents(stored).map((item) => item.id)).toEqual(["개요", "개요-1", "개요-2", "목록-안"]);
		const range = tableOfContents(stored, { min: 1, max: 4 });
		expect(range.map((item) => [item.level, item.depth])).toEqual([
			[1, 0],
			[2, 1],
			[3, 2],
			[4, 3],
			[2, 1],
			[2, 1],
		]);
		expect(tableOfContents(null as never)).toEqual([]);
	});

	it("takes the text of a heading from everything inside it", () => {
		const marked = doc({
			type: "heading",
			attrs: { level: 2 },
			content: [text("앞 "), text("코드", [{ type: "code" }]), text(" "), text("굵게", [{ type: "bold" }])],
		});
		expect(tableOfContents(marked)).toEqual([
			{ value: "앞 코드 굵게", id: "앞-코드-굵게", href: "#앞-코드-굵게", level: 2, depth: 0 },
		]);
	});

	it("does not list the footnote heading, and gives it no anchor", async () => {
		const markup = await html(footnoteDoc());
		expect(markup).toContain('<h2 class="sr-only" id="footnote-label">Footnotes</h2>');
		expect(tableOfContents(footnoteDoc()).map((item) => item.value)).toEqual(["제목"]);
	});
});

describe("component overrides", () => {
	it("passes plain props and the context to a heading component", async () => {
		const seen: { level: number; id: string; blockId?: string; ctx: RenderContext }[] = [];
		const Heading = ({ level, id, blockId, ctx, children }: HeadingProps) => {
			seen.push({ level, id, blockId, ctx });
			return createElement(`h${level}`, { id, "data-block": blockId, className: "mine" }, children);
		};
		const stored = doc({ ...heading(2, "제목"), id: "abcd1234" });
		const markup = await html(stored, { components: loose({ heading: Heading }), locale: "ko" });
		expect(markup).toBe('<h2 id="제목" data-block="abcd1234" class="mine">제목</h2>');
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ level: 2, id: "제목", blockId: "abcd1234" });
		// `ctx` is plain JSON: it can cross to a client component.
		expect(JSON.parse(JSON.stringify(seen[0]?.ctx))).toEqual(seen[0]?.ctx);
		expect(seen[0]?.ctx.locale).toBe("ko");
		expect(seen[0]?.ctx.labels.copyCode).toBe("Copy");
	});

	it("passes the resolved address and the kind of a link, and never the raw mark", async () => {
		const seen: LinkProps[] = [];
		const Link = (props: LinkProps) => {
			seen.push(props);
			return (
				<a data-mine="1" href={props.href}>
					{props.children}
				</a>
			);
		};
		const link = (href: string, title?: string) =>
			text(href, [{ type: "link", attrs: { href, ...(title ? { title } : {}) } }]);
		await html(doc(paragraph(link("/a"), link("https://example.com", "제목"), link("mailto:a@b.c"))), {
			components: loose({ marks: { link: Link } }),
			resolveHref: (href) => (href === "/a" ? "/en/a" : href),
		});
		expect(seen.map(({ href, title, external }) => ({ href, title, external }))).toEqual([
			{ href: "/en/a", title: undefined, external: false },
			{ href: "https://example.com", title: "제목", external: true },
			{ href: "mailto:a@b.c", title: undefined, external: false },
		]);
	});

	it("overrides a mark with its own component", async () => {
		const markup = await html(doc(paragraph(text("굵게", [{ type: "bold" }]))), {
			components: loose({ marks: { bold: ({ children }: { children: ReactNode }) => <b>{children}</b> } }),
		});
		expect(markup).toBe("<p><b>굵게</b></p>");
	});

	it("passes the list facts to a list component", async () => {
		const seen: ListProps[] = [];
		const List = (props: ListProps) => {
			seen.push(props);
			return <div>{props.children}</div>;
		};
		await html(
			doc(
				{
					type: "orderedList",
					attrs: { start: 3 },
					content: [
						{ type: "listItem", content: [paragraph(text("a"))] },
						{ type: "listItem", content: [paragraph(text("b"))] },
					],
				},
				{
					type: "bulletList",
					content: [
						{ type: "listItem", attrs: { checked: false }, content: [paragraph(text("c"))] },
						{ type: "listItem", content: [paragraph(text("d")), paragraph(text("more"))] },
					],
				},
			),
			{ components: loose({ list: List }) },
		);
		expect(seen.map(({ ordered, start, loose, tasks }) => ({ ordered, start, loose, tasks }))).toEqual([
			{ ordered: true, start: 3, loose: false, tasks: false },
			{ ordered: false, start: undefined, loose: true, tasks: true },
		]);
	});

	it("passes the facts of a table to its components", async () => {
		const tables: TableProps[] = [];
		const cells: TableCellProps[] = [];
		await html(
			doc({
				type: "table",
				attrs: { align: ["left", "right"], widths: [100, 200] },
				content: [
					{
						type: "tableRow",
						content: [
							{ type: "tableCell", attrs: { header: true }, content: [text("A")] },
							{ type: "tableCell", attrs: { header: true }, content: [text("B")] },
						],
					},
					{
						type: "tableRow",
						content: [
							{ type: "tableCell", content: [text("1")] },
							{ type: "tableCell", attrs: { colspan: 2 }, content: [text("2")] },
						],
					},
				],
			}),
			{
				components: loose({
					table: (props: TableProps) => {
						tables.push(props);
						return <table>{props.children}</table>;
					},
					tableCell: (props: TableCellProps) => {
						cells.push(props);
						return <td>{props.children}</td>;
					},
				}),
			},
		);
		// The merged cell reaches into a third column.
		expect(tables[0]).toMatchObject({ columns: 3, widths: [100, 200], hasHead: true });
		expect(
			cells.map(({ as, scope, colSpan, rowSpan, align, firstColumn, lastColumn, inHead }) => ({
				as,
				scope,
				colSpan,
				rowSpan,
				align,
				firstColumn,
				lastColumn,
				inHead,
			})),
		).toEqual([
			{
				as: "th",
				scope: "col",
				colSpan: 1,
				rowSpan: 1,
				align: "left",
				firstColumn: true,
				lastColumn: false,
				inHead: true,
			},
			{
				as: "th",
				scope: "col",
				colSpan: 1,
				rowSpan: 1,
				align: "right",
				firstColumn: false,
				lastColumn: false,
				inHead: true,
			},
			{
				as: "td",
				scope: undefined,
				colSpan: 1,
				rowSpan: 1,
				align: "left",
				firstColumn: true,
				lastColumn: false,
				inHead: false,
			},
			{
				as: "td",
				scope: undefined,
				colSpan: 2,
				rowSpan: 1,
				align: "right",
				firstColumn: false,
				lastColumn: true,
				inHead: false,
			},
		]);
	});

	it("keeps the layers in order: core defaults, then the table of an extension, then the site", () => {
		const Base = () => <i />;
		const Extension = () => <b />;
		const Site = () => <u />;
		const merged = mergeDocumentComponents(
			{ paragraph: Base, marks: { bold: Base, italic: Base }, blocks: { one: Base } },
			{ paragraph: Extension, marks: { bold: Extension }, blocks: { two: Extension } },
			undefined,
			{ marks: { bold: Site }, blocks: { one: Site }, heading: undefined },
		);
		expect(merged.paragraph).toBe(Extension);
		expect(merged.marks).toEqual({ bold: Site, italic: Base });
		expect(merged.blocks).toEqual({ one: Site, two: Extension });
		expect(merged.heading).toBeUndefined();
	});
});

describe("code blocks", () => {
	it("passes the language, code, title, notes and annotations, and the highlighted pre as children", async () => {
		const seen: CodeBlockProps[] = [];
		const CodeBlock = (props: CodeBlockProps) => {
			seen.push(props);
			return <figure data-language={props.language}>{props.children}</figure>;
		};
		const stored = doc(
			codeBlock(
				"ts",
				'title="a.ts" lnum',
				'// @line highlight {0-1}\nconst a = 1;\n// @char Tooltip {6-7} content="설명"\nconst b = 2;',
			),
		);
		const markup = await html(stored, { components: loose({ codeBlock: CodeBlock }) });
		const [props] = seen;
		expect(props).toMatchObject({
			language: "ts",
			code: "const a = 1;\nconst b = 2;",
			title: "a.ts",
			showLineNumbers: true,
		});
		expect(props?.annotations.lines?.map((line) => line.name)).toContain("highlight");
		expect(props?.annotations.text?.map((item) => item.name)).toContain("Tooltip");
		expect(markup).toContain('<figure data-language="ts"><pre class="shiki');
		expect(markup).toContain('data-show-line-numbers="true"');
		expect(markup).toContain('data-line="1"');
	});

	it("keeps the stored code of a tooltip note for a site component", async () => {
		const seen: string[][] = [];
		const stored = doc(codeBlock("ts", "", '// @char Tooltip {0-5} content="설명"\nconst a = 1;'));
		await html(stored, {
			components: loose({
				codeBlock: ({ notes }: CodeBlockProps) => {
					seen.push([...notes]);
					return null;
				},
				codeTags: { Tooltip: ({ children }: { children?: ReactNode }) => <mark>{children}</mark> },
			}),
		});
		expect(seen).toEqual([["설명"]]);
	});

	it("draws a render tag nobody provides as its text, and a provided one with its component", async () => {
		const stored = doc(codeBlock("ts", "", '// @char Tooltip {0-5} content="설명"\nconst a = 1;'));
		const without = await html(stored);
		expect(without).not.toContain("<Tooltip");
		expect(without).not.toContain("<tooltip");
		const withTag = await html(stored, {
			components: loose({ codeTags: { Tooltip: ({ children }: { children?: ReactNode }) => <mark>{children}</mark> } }),
		});
		expect(withTag).toContain("<mark>");
	});

	it("shows a language that is not loaded, and code that cannot be annotated, as plain text and never throws", async () => {
		const unknownLanguage = await html(doc(codeBlock("nolang", "", "some code")));
		expect(unknownLanguage).toContain("some code");
		// A stored block whose attributes are not what a fence makes.
		const odd = doc({ type: "codeBlock", attrs: { language: 7, code: 3, meta: false } as never });
		expect(await html(odd)).toContain("<pre");
	});

	it("uses the code options of the site (a highlight function of its own)", async () => {
		const highlight = vi.fn(() => ({
			type: "root" as const,
			children: [
				{
					type: "element" as const,
					tagName: "pre",
					properties: { className: ["mine"] },
					children: [
						{
							type: "element" as const,
							tagName: "code",
							properties: {},
							children: [{ type: "text" as const, value: "X" }],
						},
					],
				},
			],
		}));
		const markup = await html(docOf("```ts\nconst a = 1;\n```"), { code: { highlight: highlight as never } });
		expect(highlight).toHaveBeenCalledWith("const a = 1;", "ts", expect.anything(), expect.anything());
		expect(markup).toContain('<pre class="mine"><code>X</code></pre>');
	});

	it("leaves a language the site ignores unhighlighted", async () => {
		const markup = await html(docOf("```ts\nconst a = 1;\n```"), { code: { ignoreLang: () => true } });
		expect(markup).toContain("<pre><code>const a = 1;</code></pre>");
		expect(markup).not.toContain("shiki");
	});
});

describe("images and files", () => {
	const image = (attrs: Record<string, string | boolean>): CmsNode => ({ type: "image", attrs });

	it("gives an image component the resolved address, the size and a checked width", async () => {
		const seen: ImageProps[] = [];
		const Image = (props: ImageProps) => {
			seen.push(props);
			return <i />;
		};
		await html(
			doc(
				image({ mediaId: "m1", alt: "a", width: "60%", align: "right", rotate: "90", crop: "1,2,3,4" }),
				image({ src: "javascript:alert(1)", alt: "b", width: "9999px", align: "middle" }),
			),
			{
				components: loose({ image: Image }),
				imageResolver: ({ mediaId, src }) =>
					mediaId === "m1"
						? { url: "https://cdn.example/m1.png", width: 640, height: 480 }
						: src === "javascript:alert(1)"
							? { failure: "rejected" }
							: { failure: "unresolved" },
			},
		);
		expect(seen[0]).toMatchObject({
			src: "https://cdn.example/m1.png",
			alt: "a",
			width: "60%",
			align: "right",
			rotate: 90,
			crop: "1,2,3,4",
			intrinsic: { width: 640, height: 480 },
			failure: undefined,
			decorative: false,
			plain: false,
			inline: false,
		});
		// A width or alignment that is not allowed is not passed, and a failure leaves no address.
		expect(seen[1]).toMatchObject({ src: undefined, failure: "rejected", width: undefined, align: "center" });
	});

	it("tells an inline Markdown image from a block of its own", async () => {
		const seen: { inline: boolean; plain: boolean }[] = [];
		await html(docOf("![a](/a.png)\n\n문장 ![b](/b.png) 속"), {
			components: loose({
				image: ({ inline, plain }: ImageProps) => {
					seen.push({ inline, plain });
					return null;
				},
			}),
		});
		expect(seen).toEqual([
			{ inline: false, plain: true },
			{ inline: true, plain: true },
		]);
	});

	it("gives a file component the card facts", async () => {
		const seen: FileProps[] = [];
		await html(
			doc(
				{ type: "file", attrs: { mediaId: "pdf", label: "자료" } },
				{ type: "file", attrs: { mediaId: "none", label: "없음" } },
			),
			{
				components: loose({
					file: (props: FileProps) => {
						seen.push(props);
						return null;
					},
				}),
				imageResolver: ({ mediaId }) =>
					mediaId === "pdf"
						? {
								url: "https://cdn.example/a.pdf",
								file: { filename: "deck.pdf", byteSize: 100, mimeType: "application/pdf" },
							}
						: { failure: "unresolved" },
			},
		);
		expect(seen[0]).toMatchObject({
			mediaId: "pdf",
			label: "자료",
			url: "https://cdn.example/a.pdf",
			filename: "deck.pdf",
			byteSize: 100,
			mimeType: "application/pdf",
		});
		expect(seen[1]).toMatchObject({ mediaId: "none", label: "없음", url: undefined, failure: "unresolved" });
	});
});

describe("math", () => {
	it("passes the formula and the KaTeX output", async () => {
		const seen: { value: string; html: string }[] = [];
		await html(doc({ type: "math", attrs: { value: "x^2" } }), {
			components: loose({
				math: ({ value, html: output }: { value: string; html: string }) => {
					seen.push({ value, html: output });
					return null;
				},
			}),
		});
		expect(seen[0]?.value).toBe("x^2");
		expect(seen[0]?.html).toContain('class="katex-display"');
		expect(seen[0]?.html).toContain("<math");
	});

	it("shows a formula KaTeX cannot read, and never throws", async () => {
		expect(await html(doc({ type: "math", attrs: { value: "\\frac{1" } }))).toContain("katex");
		expect(await html(doc({ type: "math", attrs: { value: 5 as never } }))).toContain("katex");
	});
});

describe("footnotes", () => {
	it("numbers footnotes by first reference and passes the items to the footnotes component", async () => {
		const seen: FootnotesProps[] = [];
		const stored = doc(
			paragraph(
				text("하나"),
				{ type: "footnoteReference", attrs: { label: "b" } },
				text(" 둘"),
				{ type: "footnoteReference", attrs: { label: "a" } },
				text(" 다시"),
				{ type: "footnoteReference", attrs: { label: "b" } },
			),
			{ type: "footnoteDefinition", attrs: { label: "a" }, content: [paragraph(text("A"))] },
			{ type: "footnoteDefinition", attrs: { label: "b" }, content: [paragraph(text("B"))] },
		);
		await html(stored, {
			components: loose({
				footnotes: (props: FootnotesProps) => {
					seen.push(props);
					return (
						<aside>
							{props.items.map((item) => (
								<div key={item.id}>{item.children}</div>
							))}
						</aside>
					);
				},
			}),
		});
		expect(seen[0]?.items.map(({ id, label, index, backRefIds }) => ({ id, label, index, backRefIds }))).toEqual([
			{ id: "user-content-fn-b", label: "b", index: 1, backRefIds: ["user-content-fnref-b", "user-content-fnref-b-2"] },
			{ id: "user-content-fn-a", label: "a", index: 2, backRefIds: ["user-content-fnref-a"] },
		]);
	});

	it("matches a reference to its definition without regard to case and spaces", async () => {
		const markup = await html(
			doc(paragraph(text("a"), { type: "footnoteReference", attrs: { label: " Note  One " } }), {
				type: "footnoteDefinition",
				attrs: { label: "note one" },
				content: [paragraph(text("def"))],
			}),
		);
		expect(markup).toContain('href="#user-content-fn-note%20one"');
		expect(markup).toContain("def");
	});

	it("writes a reference without a definition as the text it was", async () => {
		expect(
			await html(doc(paragraph(text("정의 없는 참조"), { type: "footnoteReference", attrs: { label: "none" } }))),
		).toContain("[^none]");
	});

	it("does not draw a definition nobody refers to, and uses the first of two", async () => {
		const markup = await html(
			doc(
				paragraph(text("a"), { type: "footnoteReference", attrs: { label: "x" } }),
				{ type: "footnoteDefinition", attrs: { label: "x" }, content: [paragraph(text("첫째"))] },
				{ type: "footnoteDefinition", attrs: { label: "x" }, content: [paragraph(text("둘째"))] },
				{ type: "footnoteDefinition", attrs: { label: "y" }, content: [paragraph(text("안 쓰임"))] },
			),
		);
		expect(markup).toContain("첫째");
		expect(markup).not.toContain("둘째");
		expect(markup).not.toContain("안 쓰임");
	});

	it("uses the labels of the site", async () => {
		const markup = await html(footnoteDoc(), {
			labels: { footnotes: "각주", footnoteBack: "{ref}번 참조로" },
		});
		expect(markup).toContain(">각주</h2>");
		expect(markup).toContain('aria-label="1번 참조로"');
	});
});

describe("blocks", () => {
	const container = testSite.ADDED_BLOCKS.find(
		(block) => block.syntax.kind === "container" && !block.parent && !block.children?.blocks,
	);
	const text_ = testSite.ADDED_BLOCKS.find((block) => block.syntax.kind === "text");

	it.skipIf(!container)(
		"passes the attributes of a block as flat props with its children, items and node",
		async () => {
			const block = container as NonNullable<typeof container>;
			const seen: Record<string, unknown>[] = [];
			const Block = (props: Record<string, unknown>) => {
				seen.push(props);
				return <section>{props.children as ReactNode}</section>;
			};
			const names = Object.keys(block.attributes);
			const attrs: Record<string, string | boolean> = {};
			for (const [name, attribute] of Object.entries(block.attributes)) {
				attrs[name] = attribute.type === "boolean" ? true : (Object.keys(attribute.options ?? {})[0] ?? "값");
			}
			const stored = doc({
				type: block.name,
				id: "blk00001",
				attrs,
				content: [paragraph(text("안")), paragraph(text("밖"))],
			});
			const markup = await html(stored, { components: loose({ blocks: { [block.name]: Block } }) });
			expect(markup).toBe("<section><p>안</p><p>밖</p></section>");
			const [props] = seen;
			for (const name of names) expect(props?.[name]).toBe(attrs[name]);
			expect(props?.blockId).toBe("blk00001");
			expect((props?.node as CmsNode).type).toBe(block.name);
			expect((props?.items as { node: CmsNode }[]).map((item) => item.node.type)).toEqual(["paragraph", "paragraph"]);
			expect((props?.ctx as RenderContext).labels).toBeDefined();
		},
	);

	it.skipIf(!container)(
		"replaces a choice that is not allowed with the default, and never passes a missing boolean as undefined",
		async () => {
			const block = container as NonNullable<typeof container>;
			const choice = Object.entries(block.attributes).find(
				([, attribute]) => attribute.options && attribute.defaultValue !== undefined,
			);
			const flag = Object.entries(block.attributes).find(([, attribute]) => attribute.type === "boolean");
			const seen: Record<string, unknown>[] = [];
			const Block = (props: Record<string, unknown>) => {
				seen.push(props);
				return null;
			};
			await html(
				doc({
					type: block.name,
					attrs: choice ? { [choice[0]]: "not-an-option" } : {},
					content: [paragraph(text("x"))],
				}),
				{
					components: loose({ blocks: { [block.name]: Block } }),
				},
			);
			if (choice) expect(seen[0]?.[choice[0]]).toBe(choice[1].defaultValue);
			if (flag) expect(seen[0]?.[flag[0]]).toBe(false);
		},
	);

	it.skipIf(!text_)("passes the attributes of a text block to its mark component", async () => {
		const block = text_ as NonNullable<typeof text_>;
		const seen: Record<string, unknown>[] = [];
		const Mark = (props: Record<string, unknown>) => {
			seen.push(props);
			return <span>{props.children as ReactNode}</span>;
		};
		const attrs = Object.fromEntries(Object.entries(block.attributes).map(([name]) => [name, "#dc2626"]));
		await html(doc(paragraph(text("글", [{ type: block.name, attrs }]))), {
			components: loose({ marks: { [block.name]: Mark } }),
		});
		for (const name of Object.keys(block.attributes)) expect(seen[0]?.[name]).toBe("#dc2626");
		expect(seen[0]?.ctx).toBeDefined();
	});

	it("routes a code fence of a block to the block with the code as source", async () => {
		const fence = testSite.ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");
		if (!fence || fence.syntax.kind !== "fence") return;
		const seen: Record<string, unknown>[] = [];
		await html(doc({ type: "codeBlock", attrs: { language: fence.syntax.lang, meta: "", code: "A -> B" } }), {
			components: loose({
				blocks: {
					[fence.name]: (props: Record<string, unknown>) => {
						seen.push(props);
						return null;
					},
				},
			}),
		});
		expect(seen[0]?.source).toBe("A -> B");
	});
});

describe("unknown content: a fallback, never an error", () => {
	const unknownCases: Record<string, CmsNode> = {
		"an unknown node": { type: "mystery", content: [paragraph(text("안에"))] },
		"a raw JSX element": {
			type: "mdxJsx",
			attrs: { name: "Fragment", attributes: [] },
			content: [paragraph(text("안에"))],
		},
		"raw HTML": { type: "html", attrs: { value: "<b>x</b>" } },
		"an expression": { type: "mdxExpression", attrs: { value: "1 + 1" } },
		"an ESM block": { type: "mdxEsm", attrs: { value: "export const a = 1" } },
		"a node out of its place": { type: "tableCell", content: [text("셀")] },
		"a heading with a level that does not exist": { type: "heading", attrs: { level: 9 }, content: [text("제목")] },
		"a list item at the top": { type: "listItem", content: [paragraph(text("항목"))] },
	};

	it.each(Object.entries(unknownCases))("renders %s through the fallback and lists it", async (_name, node) => {
		const seen: UnknownProps[] = [];
		const Fallback = (props: UnknownProps) => {
			seen.push(props);
			return <span data-fallback={props.reason}>{props.children}</span>;
		};
		const stored = doc(paragraph(text("앞")), node, paragraph(text("뒤")));
		const rendered = await renderDocument(stored, { site: testSite, components: loose({ fallback: Fallback }) });
		const markup = renderToStaticMarkup(rendered.content as ReactNode);
		expect(markup).toContain("앞");
		expect(markup).toContain("뒤");
		expect(markup).toContain("data-fallback");
		expect(rendered.unknown.map((item) => item.type)).toEqual([node.type]);
		expect(seen[0]?.node.type).toBe(node.type);
		expect(seen[0]?.ctx).toBeDefined();
	});

	it("shows the content of an unknown container and nothing for an unknown leaf, by default", async () => {
		expect(await html(doc(unknownCases["an unknown node"] as CmsNode))).toContain("안에");
		expect(await html(doc(unknownCases["raw HTML"] as CmsNode))).not.toContain("<b>");
		expect(await html(doc(unknownCases["an expression"] as CmsNode))).not.toContain("1 + 1");
	});

	it("marks an unknown node in development only, with a hidden element", async () => {
		try {
			vi.stubEnv("NODE_ENV", "development");
			expect(await html(doc({ type: "mystery" }))).toContain('<span data-cms-unknown="mystery" hidden=""></span>');
			vi.stubEnv("NODE_ENV", "production");
			expect(await html(doc({ type: "mystery" }))).toBe("");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("renders an unknown mark as plain text", async () => {
		const stored = doc(paragraph(text("글", [{ type: "mystery-mark" }, { type: "bold" }])));
		const rendered = await renderDocument(stored, { site: testSite });
		expect(renderToStaticMarkup(rendered.content as ReactNode)).toContain("글");
		expect(rendered.unknown.map((node) => node.type)).toEqual(["text"]);
	});

	it("tells the caller about each unknown node once, and lets strict mode throw", async () => {
		const onUnknown = vi.fn();
		const stored = doc(
			{ type: "mystery" },
			paragraph(text("a", [{ type: "mystery-mark" }]), text("b", [{ type: "mystery-mark" }])),
		);
		const rendered = await renderDocument(stored, { site: testSite, onUnknown });
		// The unknown node, and the text the unknown mark is on (two neighbours in one mark are one run, so one report).
		expect(onUnknown).toHaveBeenCalledTimes(2);
		expect(rendered.unknown).toHaveLength(2);
		await expect(renderDocument(stored, { site: testSite, strict: true })).rejects.toThrow(/Unknown content/);
	});

	it("falls back for a block of the config that has no component, and still shows its content", async () => {
		const block = testSite.ADDED_BLOCKS.find((candidate) => candidate.syntax.kind === "container" && !candidate.parent);
		if (!block) return;
		const stored = doc({ type: block.name, content: [paragraph(text("안에"))] });
		const rendered = await renderDocument(stored, { site: testSite });
		expect(renderToStaticMarkup(rendered.content as ReactNode)).toContain("안에");
		expect(rendered.unknown.map((node) => node.type)).toEqual([block.name]);
	});

	describe("missing component warning", () => {
		const block = testSite.ADDED_BLOCKS.find((candidate) => candidate.syntax.kind === "container" && !candidate.parent);
		const stored = block ? doc({ type: block.name, content: [paragraph(text("x"))] }) : doc();

		afterEach(() => {
			vi.unstubAllEnvs();
			vi.restoreAllMocks();
		});

		it.skipIf(!block)("warns once per block name in development", async () => {
			vi.stubEnv("NODE_ENV", "development");
			resetMissingComponentWarnings();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			await renderDocument(stored, { site: testSite });
			await renderDocument(stored, { site: testSite });
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0])).toContain(`"${block?.name}"`);
		});

		it.skipIf(!block)("stays silent in production and still renders the fallback", async () => {
			vi.stubEnv("NODE_ENV", "production");
			resetMissingComponentWarnings();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const rendered = await renderDocument(stored, { site: testSite });
			expect(warn).not.toHaveBeenCalled();
			expect(rendered.unknown).toHaveLength(1);
		});
	});

	it("falls back for a block with an attribute of the wrong kind", async () => {
		const block = testSite.ADDED_BLOCKS.find(
			(candidate) =>
				candidate.syntax.kind === "container" && !candidate.parent && Object.keys(candidate.attributes).length > 0,
		);
		if (!block) return;
		const [name] = Object.keys(block.attributes);
		const component = vi.fn(() => <i />);
		const stored = doc({
			type: block.name,
			attrs: { [name as string]: { nested: "object" } },
			content: [paragraph(text("안에"))],
		});
		const rendered = await renderDocument(stored, {
			site: testSite,
			components: loose({ blocks: { [block.name]: component } }),
		});
		expect(component).not.toHaveBeenCalled();
		expect(rendered.unknown.map((node) => node.type)).toEqual([block.name]);
		expect(renderToStaticMarkup(rendered.content as ReactNode)).toContain("안에");
	});

	it("never throws on content, whatever the attributes hold", async () => {
		const weird: CmsNode[] = [
			{ type: "image", attrs: { src: 5 as never, alt: { a: 1 } as never } },
			{ type: "file", attrs: { mediaId: [] as never } },
			{
				type: "table",
				attrs: { widths: "x" as never, align: 7 as never },
				content: [
					{
						type: "tableRow",
						content: [{ type: "tableCell", attrs: { colspan: "abc" as never, rowspan: -4 as never } }],
					},
				],
			},
			{
				type: "bulletList",
				attrs: { start: "x" as never },
				content: [{ type: "listItem", attrs: { checked: "yes" as never } }, text("stray")],
			},
			{ type: "text-align", attrs: { align: 5 as never }, content: [paragraph(text("a"))] },
			paragraph(
				{ type: "footnoteReference", attrs: { label: 4 as never } },
				{ type: "hardBreak" },
				text("x", [{ type: "link", attrs: { href: 5 as never } }]),
			),
			{ type: "heading", content: [text("레벨 없음")] },
			{ type: "blockquote" },
			{ type: "codeBlock" },
			{ type: "math" },
			{ type: "footnoteDefinition", attrs: { label: "x" } },
		];
		for (const node of weird) {
			await expect(renderDocument(doc(paragraph(text("앞")), node), { site: testSite })).resolves.toBeDefined();
		}
	});
});

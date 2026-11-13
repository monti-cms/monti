import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { readMarkdown, toMdx } from "./index";

/** A body without its block ids: two readings of the same text are the same body. */
const bare = (doc: Doc) => {
	const strip = ({ id: _id, children, ...block }: Block): unknown => ({
		...block,
		...(children ? { children: children.map(strip) } : {}),
	});
	return doc.blocks.map(strip);
};
const text = (value: string, ...marks: { type: string; [key: string]: unknown }[]) => ({
	type: "text" as const,
	text: value,
	...(marks.length > 0 ? { marks } : {}),
});

describe("reading a markdown file (T34)", () => {
	it("14-1 front matter is the file's values; headings, paragraphs and marks are the body", () => {
		const read = readMarkdown(
			[
				"---",
				"title: 가을 산행",
				"tags: [여행, 산]",
				"draft: true",
				"---",
				"",
				"# 큰 제목",
				"",
				"첫 **굵은** 문단과 *기울인* 말, ~~지운~~ 말, `code`, [링크](https://example.dev), <u>밑줄</u>.",
				"",
				"#### 넷째",
				"###### 여섯째",
			].join("\n"),
		);
		expect(read.values).toEqual({ title: "가을 산행", tags: ["여행", "산"], draft: true });
		expect(bare(read.doc)).toEqual([
			{ type: "heading", attrs: { level: 2 }, content: [text("큰 제목")] },
			{
				type: "paragraph",
				content: [
					text("첫 "),
					text("굵은", { type: "bold" }),
					text(" 문단과 "),
					text("기울인", { type: "italic" }),
					text(" 말, "),
					text("지운", { type: "strike" }),
					text(" 말, "),
					text("code", { type: "code" }),
					text(", "),
					text("링크", { type: "link", href: "https://example.dev" }),
					text(", "),
					text("밑줄", { type: "underline" }),
					text("."),
				],
			},
			{ type: "heading", attrs: { level: 4 }, content: [text("넷째")] },
			{ type: "heading", attrs: { level: 4 }, content: [text("여섯째")] },
		]);
		expect(read.unknown).toEqual([]);
	});

	it("14-1 lists, a checklist, a quote, a table, a rule, a picture and footnotes each become their block", () => {
		const read = readMarkdown(
			[
				"- 하나",
				"- 둘",
				"  - 둘의 안",
				"",
				"3. 셋",
				"4. 넷",
				"",
				"- [x] 한 일",
				"- [ ] 할 일",
				"",
				"> 인용한 말",
				"",
				"| 이름 | 값 |",
				"| --- | --- |",
				"| a | **1** |",
				"",
				"---",
				"",
				'![산길](./img/trail.png "오르는 길")',
				"",
				"각주가 있다.[^1]",
				"",
				"[^1]: 각주의 말.",
			].join("\n"),
		);
		expect(bare(read.doc)).toEqual([
			{
				type: "bulletList",
				children: [
					{ type: "listItem", content: [text("하나")] },
					{ type: "listItem", content: [text("둘")] },
					{ type: "listItem", content: [text("둘의 안")] },
				],
			},
			{
				type: "orderedList",
				attrs: { start: 3 },
				children: [
					{ type: "listItem", content: [text("셋")] },
					{ type: "listItem", content: [text("넷")] },
				],
			},
			{
				type: "checklist",
				children: [
					{ type: "listItem", attrs: { checked: true }, content: [text("한 일")] },
					{ type: "listItem", attrs: { checked: false }, content: [text("할 일")] },
				],
			},
			{ type: "quote", children: [{ type: "paragraph", content: [text("인용한 말")] }] },
			{
				type: "table",
				attrs: {
					header: true,
					rows: [
						["이름", "값"],
						["a", "1"],
					],
				},
			},
			{ type: "divider" },
			{ type: "image", attrs: { src: "./img/trail.png", alt: "산길", caption: "오르는 길" } },
			{ type: "paragraph", content: [text("각주가 있다."), { type: "footnoteRef", id: "1" }] },
			{ type: "footnote", attrs: { id: "1" }, content: [text("각주의 말.")] },
		]);
	});

	it("17-10 a code block's Shiki notation becomes its line effects, and is written back so it reads the same (T79)", () => {
		const code = ["const a = 1; // [!code --]", "const a = 2; // [!code ++]", "// [!code highlight:2]", "run(a);"].join(
			"\n",
		);
		const read = readMarkdown(`\`\`\`ts {1,3} title="a.ts"\n${code}\n\`\`\`\n`);
		expect(bare(read.doc)).toEqual([
			{
				type: "codeBlock",
				attrs: {
					language: "ts",
					title: "a.ts",
					meta: "{1,3}",
					lines: [
						{ name: "minus", start: 0, end: 1 },
						{ name: "plus", start: 1, end: 2 },
						{ name: "highlight", start: 2, end: 3 },
					],
				},
				content: [text("const a = 1;\nconst a = 2;\nrun(a);")],
			},
		]);
		const written = toMdx(read.doc);
		expect(written).toBe(
			'```ts title="a.ts" {1,3}\nconst a = 1; // [!code --]\nconst a = 2; // [!code ++]\nrun(a); // [!code highlight]\n```\n',
		);
		expect(bare(readMarkdown(written).doc)).toEqual(bare(read.doc));
	});

	it("17-10 a code link names a label: it goes to the code block with it, and is written back as CodeRef", () => {
		const file = [
			'See <CodeRef to="c1">this line</CodeRef> and :code-ref[that one]{to="c9"}.',
			"",
			"```ts",
			'// @line anchor {0-0} id="c1"',
			"const a = 1;",
			"```",
			"",
		].join("\n");
		const read = readMarkdown(file);
		const [paragraph, codeBlock] = read.doc.blocks;
		expect(paragraph.content).toEqual([
			text("See "),
			{ type: "text", text: "this line", marks: [{ type: "codeRef", block: codeBlock.id, anchor: "c1" }] },
			text(" and "),
			{ type: "text", text: "that one", marks: [{ type: "codeRef", block: "-", anchor: "c9" }] },
			text("."),
		]);
		expect(toMdx({ type: "doc", blocks: [paragraph] })).toBe(
			'See <CodeRef to="c1">this line</CodeRef> and <CodeRef to="c9">that one</CodeRef>.\n',
		);
	});

	it("14-1 a directive that names one of the site's blocks becomes that block; one that names none, and a component, are kept as written and named", () => {
		const known = (type: string) =>
			type === "callout"
				? ("blocks" as const)
				: type === "note"
					? ("text" as const)
					: type === "chart"
						? ("nothing" as const)
						: null;
		const source = [
			':::callout{tone="info" wide}',
			"안의 **문단**.",
			"",
			"- 목록",
			":::",
			"",
			":::note",
			"한 줄.",
			":::",
			"",
			'::chart{data="a.csv" height=240}',
			"",
			":::tabs",
			"모르는 것.",
			":::",
			"",
			'<Tweet id="123" />',
			"",
			"<!-- 숨긴 말 -->",
		].join("\n");
		const read = readMarkdown(source, { known });
		expect(bare(read.doc)).toEqual([
			{
				type: "callout",
				attrs: { tone: "info", wide: true },
				children: [
					{ type: "paragraph", content: [text("안의 "), text("문단", { type: "bold" }), text(".")] },
					{ type: "bulletList", children: [{ type: "listItem", content: [text("목록")] }] },
				],
			},
			{ type: "note", content: [text("한 줄.")] },
			{ type: "chart", attrs: { data: "a.csv", height: 240 } },
			{ type: "codeBlock", attrs: { language: "mdx-kept" }, content: [text(":::tabs\n모르는 것.\n:::")] },
			{ type: "codeBlock", attrs: { language: "mdx-kept" }, content: [text('<Tweet id="123" />')] },
		]);
		expect(read.unknown).toEqual(["tabs", "Tweet"]);
		// Without the site's blocks, every directive is kept as written.
		expect(readMarkdown(source).unknown).toEqual(["callout", "note", "chart", "tabs", "Tweet"]);
	});

	it("14-1 a link and a picture by the name of an address the file defines get that address, and a script address is no link", () => {
		const { doc } = readMarkdown(
			[
				"See the [docs][d] and [nothing][none].",
				"",
				"![cover][c]",
				"",
				"[run](javascript:alert(1)) [it](java&#x09;script:alert(1))",
				"",
				"[d]: https://example.com/docs",
				'[c]: ./img/cover.png "The cover"',
			].join("\n"),
		);
		const [first, picture, last] = doc.blocks;
		expect(first?.content).toEqual([
			{ type: "text", text: "See the " },
			{ type: "text", text: "docs", marks: [{ type: "link", href: "https://example.com/docs" }] },
			// A name the file defines no address for is just the words it was written as.
			{ type: "text", text: " and [nothing][none]." },
		]);
		expect(picture).toMatchObject({
			type: "image",
			attrs: { src: "./img/cover.png", alt: "cover", caption: "The cover" },
		});
		// Neither is a link: the words stay, with no mark.
		expect(last?.content?.map((each) => ("text" in each ? each.text : "")).join("")).toBe("run it");
		expect(JSON.stringify(last?.content)).not.toContain("link");
		expect(doc.blocks).toHaveLength(3);
	});

	it("14-1 an .mdx file's own lines of code are not the entry's words", () => {
		const source = 'import Chart from "./chart"\n\nexport const meta = {}\n\n글의 시작.\n';
		expect(bare(readMarkdown(source, { mdx: true }).doc)).toEqual([
			{ type: "paragraph", content: [text("글의 시작.")] },
		]);
		expect(readMarkdown(source).doc.blocks).toHaveLength(3);
	});
});

describe("writing a body as MDX (T34)", () => {
	it("14-1 what is read is written back to the same body: the text may differ in spelling, the blocks do not", () => {
		const known = (type: string) =>
			type === "callout" ? ("blocks" as const) : type === "chart" ? ("nothing" as const) : null;
		const source = [
			"## 제목",
			"",
			"문단의 **굵은** 말과 [링크](https://example.dev/a_b), 별표 \\* 그대로, <sup>위</sup>.",
			"",
			"- 하나",
			"- 둘",
			"",
			"1. 첫째",
			"2. 둘째",
			"",
			"- [x] 한 일",
			"- [ ] 할 일",
			"",
			"> 인용",
			">",
			"> 둘째 줄",
			"",
			"| 이름 | 값 |",
			"| --- | --- |",
			"| a \\| b | 1 |",
			"",
			"---",
			"",
			"```js",
			"const fence = '```';",
			"```",
			"",
			':::callout{tone="warn"}',
			"조심.",
			"",
			'::chart{data="a.csv"}',
			":::",
			"",
			'<Tweet id="1" />',
			"",
			"끝.[^n]",
			"",
			"[^n]: 주석.",
		].join("\n");
		const first = readMarkdown(source, { known });
		const written = toMdx(first.doc);
		expect(bare(readMarkdown(written, { known }).doc)).toEqual(bare(first.doc));
		// Written twice, the same text: nothing of the moment is in it.
		expect(toMdx(readMarkdown(written, { known }).doc)).toBe(written);
		expect(written).toContain("````js\nconst fence = '```';\n````");
		expect(written).toContain('<Tweet id="1" />');
	});

	it("14-1 words that look like markup are written so they read back as the same words: a line starting like a list or a heading, a ! before a link, backticks in code, marks in a table cell, a code block in html", () => {
		const doc: Doc = {
			type: "doc",
			blocks: [
				{ id: "a", type: "paragraph", content: [text("1. 서론이 아니라 문장")] },
				{ id: "b", type: "paragraph", content: [text("# 해시로 시작하는 문장")] },
				{ id: "c", type: "paragraph", content: [text("- 줄표로 시작 > 그리고 {중괄호}")] },
				{
					id: "d",
					type: "paragraph",
					content: [text("와!"), text("여기", { type: "link", href: "https://example.com" })],
				},
				{ id: "e", type: "paragraph", content: [text("a `b` c", { type: "code" })] },
				{
					id: "f",
					type: "table",
					attrs: {
						header: true,
						rows: [
							["a*b*c", "x|y"],
							["1", "2"],
						],
					},
				},
				{ id: "g", type: "codeBlock", attrs: { language: "html" }, content: [text("<p>코드로 쓴 것</p>")] },
			],
		};
		const written = toMdx(doc);
		expect(written).toContain("```html\n<p>코드로 쓴 것</p>\n```");
		expect(bare(readMarkdown(written).doc)).toEqual(bare(doc));
	});

	it("14-1 a picture is named by the library's address when one is given, and values go first as front matter", () => {
		const doc: Doc = {
			type: "doc",
			blocks: [
				{ id: "a", type: "image", attrs: { media: "m1", alt: "산" } },
				{ id: "b", type: "file", attrs: { media: "m2", name: "표.pdf" } },
			],
		};
		expect(toMdx(doc)).toBe("![산](media:m1)\n\n[표.pdf](media:m2)\n");
		expect(toMdx(doc, { mediaUrl: (id) => `/files/${id}`, values: { title: "가을", tags: ["a"], empty: "" } })).toBe(
			'---\ntitle: "가을"\ntags: ["a"]\n---\n\n![산](/files/m1)\n\n[표.pdf](/files/m2)\n',
		);
		expect(toMdx(null)).toBe("");
	});
});

describe("the blocks package's notations (doc 18)", () => {
	const known = (type: string) =>
		(({ callout: "blocks", tabs: "blocks", tab: "blocks", math: "nothing", mermaid: "nothing" })[type] as
			| "blocks"
			| "nothing"
			| undefined) ?? null;
	const fences = { math: { language: "math", attr: "source" }, mermaid: { language: "mermaid", attr: "source" } };
	const fenced = (language: string) => {
		const found = Object.entries(fences).find(([, fence]) => fence.language === language);
		return found ? { type: found[0], attr: found[1].attr } : null;
	};
	const marks = (name: string) => name === "color" || name === "tooltip";
	const site = { known, fenced, marks };

	it("18-3 a value with quote marks, an ampersand or a line end is written so it reads back as it was", () => {
		const doc: Doc = {
			type: "doc",
			blocks: [
				{
					id: "a",
					type: "callout",
					attrs: { tone: "warning", title: '그가 "네"라고 & 말했다' },
					children: [{ id: "b", type: "paragraph", content: [text("본문")] }],
				},
				{
					id: "c",
					type: "paragraph",
					content: [text("RSC", { type: "tooltip", text: 'React "Server"\nComponents' })],
				},
			],
		};
		const written = toMdx(doc);
		expect(written).toContain('title="그가 &quot;네&quot;라고 &amp; 말했다"');
		expect(bare(readMarkdown(written, site).doc)).toEqual(bare(doc));
	});

	it("18-3 a formula and a diagram are fenced code of their language, read into the site's block and written back", () => {
		const source = [
			"```math",
			"f(x) = \\int e^{-x^2} dx",
			"```",
			"",
			"```mermaid",
			"flowchart LR",
			"  A --> B",
			"```",
		].join("\n");
		const read = readMarkdown(source, site);
		expect(bare(read.doc)).toEqual([
			{ type: "math", attrs: { source: "f(x) = \\int e^{-x^2} dx" } },
			{ type: "mermaid", attrs: { source: "flowchart LR\n  A --> B" } },
		]);
		const written = toMdx(read.doc, { fences });
		expect(written).toBe(`${source}\n`);
		// A site without those blocks keeps them as code of that language: nothing is lost.
		expect(bare(readMarkdown(source).doc)).toEqual([
			{ type: "codeBlock", attrs: { language: "math" }, content: [text("f(x) = \\int e^{-x^2} dx")] },
			{ type: "codeBlock", attrs: { language: "mermaid" }, content: [text("flowchart LR\n  A --> B")] },
		]);
	});

	it("18-3 $$ … $$ is a formula; a single $ is a price and stays words", () => {
		const read = readMarkdown(["$$", "a^2 + b^2 = c^2", "$$", "", "커피는 $5, 빵은 $3이다."].join("\n"), site);
		expect(bare(read.doc)).toEqual([
			{ type: "math", attrs: { source: "a^2 + b^2 = c^2" } },
			{ type: "paragraph", content: [text("커피는 $5, 빵은 $3이다.")] },
		]);
		expect(toMdx(read.doc, { fences })).toBe("```math\na^2 + b^2 = c^2\n```\n\n커피는 $5, 빵은 $3이다.\n");
	});

	it("18-3 the site's marks are text directives; one the site does not have stays as it was written", () => {
		const source =
			'빨간 :color[말]{color="red"}과 :tooltip[**RSC**]{text="React Server Components"}, 그리고 :badge[새]{tone="new"}.';
		const read = readMarkdown(source, site);
		expect(bare(read.doc)).toEqual([
			{
				type: "paragraph",
				content: [
					text("빨간 "),
					text("말", { type: "color", color: "red" }),
					text("과 "),
					text("RSC", { type: "tooltip", text: "React Server Components" }, { type: "bold" }),
					text(', 그리고 :badge[새]{tone="new"}.'),
				],
			},
		]);
		const written = toMdx(read.doc);
		expect(bare(readMarkdown(written, site).doc)).toEqual(bare(read.doc));
		expect(written).toContain(':color[말]{color="red"}');
		expect(written).toContain(':tooltip[**RSC**]{text="React Server Components"}');
	});

	it("18-3 a code fence's title is the file's name; the rest of its line is kept (doc 17's meta)", () => {
		const source = [
			':::code-explorer{open="src/app.ts"}',
			'```ts title="src/app.ts" {1}',
			"export const a = 1;",
			"```",
			"",
			'``` title="README"',
			"읽어 보세요",
			"```",
			":::",
		].join("\n");
		const read = readMarkdown(source, { known: (type) => (type === "code-explorer" ? "blocks" : null) });
		expect(bare(read.doc)).toEqual([
			{
				type: "code-explorer",
				attrs: { open: "src/app.ts" },
				children: [
					{
						type: "codeBlock",
						attrs: { language: "ts", title: "src/app.ts", meta: "{1}" },
						content: [text("export const a = 1;")],
					},
					{ type: "codeBlock", attrs: { title: "README" }, content: [text("읽어 보세요")] },
				],
			},
		]);
		const written = toMdx(read.doc);
		expect(bare(readMarkdown(written, { known: (type) => (type === "code-explorer" ? "blocks" : null) }).doc)).toEqual(
			bare(read.doc),
		);
	});
});

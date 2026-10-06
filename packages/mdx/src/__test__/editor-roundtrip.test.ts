import { OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "@monti-cms/admin/editor";
import type { StoredDocument } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { mdxBrowserFormat } from "../admin";
import { docOfMdx } from "../testing";

/**
 * MDX notation through the editor's JSON and back, text in and text out. The admin tests build their documents by hand and assert on the stored document;
 * what a body is written as in MDX (the notation of footnotes, tables, blocks, marks and code annotations) is checked here, where the format is.
 */

const tiptapOf = (mdx: string): JSONContent => storedToTiptap(docOfMdx(mdx));
const mdxOfDoc = (doc: StoredDocument): string => mdxBrowserFormat.export(doc);
const mdxOfTiptap = (json: JSONContent): string => mdxOfDoc(tiptapToStored(json));
/** MDX through the editor and back to MDX. */
const roundTrip = (mdx: string) => mdxOfTiptap(tiptapOf(mdx));

describe("preview blocks", () => {
	it.each([
		["an image", '<Image mediaId="m1" alt="고양이" width="50%" align="left" />'],
		["a code block", '```ts title="a.ts"\nconst a = 1;\n```'],
		["a table", "| a | b |\n| :-- | --: |\n| 1 | 2 |"],
		["a Mermaid diagram", "```mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid with its case preserved", "```Mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid with its meta preserved", '```mermaid title="diagram.mmd"\ngraph TD;\n    A-->B;\n```'],
		["a chart", '```chart\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["a chart with its meta and case preserved", '```Chart title="sales"\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["math", "$$\nx^2 + y^2 = z^2\n$$"],
	])("round-trips %s", (_, source) => {
		expect(roundTrip(source).trim()).toBe(source);
	});

	it("writes a preview block with its new value after it changes", () => {
		const mermaidDoc = tiptapOf("```mermaid\ngraph TD;\n    A-->B;\n```");
		const mermaidBlock = mermaidDoc.content?.find((b) => b.type === "cmsMermaid");
		if (mermaidBlock?.attrs) mermaidBlock.attrs.value = "graph LR;\n    C-->D;";
		expect(mdxOfTiptap(mermaidDoc).trim()).toBe("```mermaid\ngraph LR;\n    C-->D;\n```");

		const chartDoc = tiptapOf('```chart\npie\n  "A": 10\n```');
		const chartBlock = chartDoc.content?.find((b) => b.type === "cmsChart");
		if (chartBlock?.attrs) chartBlock.attrs.value = 'pie\n  "B": 20';
		expect(mdxOfTiptap(chartDoc).trim()).toBe('```chart\npie\n  "B": 20\n```');

		const mathDoc = tiptapOf("$$\nx^2\n$$");
		const mathBlock = mathDoc.content?.find((b) => b.type === "cmsMath");
		if (mathBlock?.attrs) mathBlock.attrs.value = "y^2";
		expect(mdxOfTiptap(mathDoc).trim()).toBe("$$\ny^2\n$$");
	});
});

describe("footnotes", () => {
	const SOURCE = [
		"First[^a] and second[^b] and first again[^a].",
		"",
		"[^a]: Note A",
		"",
		"[^b]: Note B",
		"",
		"    ```ts",
		"    x();",
		"    ```",
		"",
	].join("\n");

	it("round-trips references and definitions, also with code inside a definition", () => {
		expect(roundTrip(SOURCE)).toBe(SOURCE);
	});

	it("opens as editable nodes instead of a source box", () => {
		const json = tiptapOf(SOURCE);
		expect(JSON.stringify(json)).not.toContain(OPAQUE_BLOCK_NAME);
		expect(json.content?.[0]?.content?.[1]).toMatchObject({ type: "footnoteReference", attrs: { label: "a" } });
		expect(json.content?.[1]).toMatchObject({ type: "footnoteDefinition", attrs: { label: "a" } });
	});

	it("saves an empty definition as empty", () => {
		const mdx = "Text[^1]\n\n[^1]:\n";
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("keeps references in headings, lists and table cells", () => {
		const mdx = "## Title[^1]\n\n- item[^2]\n\n| h |\n| --- |\n| cell[^3] |\n\n[^1]: a\n\n[^2]: b\n\n[^3]: c\n";
		expect(JSON.stringify(tiptapOf(mdx))).not.toContain(OPAQUE_BLOCK_NAME);
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("moves a definition nested by pasting or dragging out to the top level when saving", () => {
		const mdx = mdxOfTiptap({
			type: "doc",
			content: [
				{
					type: "footnoteDefinition",
					attrs: { label: "1" },
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "outer" }] },
						{
							type: "footnoteDefinition",
							attrs: { label: "2" },
							content: [{ type: "paragraph", content: [{ type: "text", text: "inner" }] }],
						},
					],
				},
			],
		});
		expect(mdx).toBe("[^1]: outer\n\n[^2]: inner\n");
	});

	it("keeps a reference without a definition across saves", () => {
		const mdx = "Text[^1] here.\n";
		expect(roundTrip(mdx)).toBe(mdx);
		expect(roundTrip(roundTrip(mdx))).toBe(mdx);
	});
});

describe("tables", () => {
	it("round-trips a merged table, with the alignment of its columns", () => {
		const source = [
			'<Table align="left,center">',
			"<TableRow>",
			'<TableCell header colspan="2">머리글</TableCell>',
			"</TableRow>",
			"<TableRow>",
			'<TableCell rowspan="2">내용1</TableCell>',
			"<TableCell>내용2</TableCell>",
			"</TableRow>",
			"<TableRow>",
			"<TableCell>내용3</TableCell>",
			"</TableRow>",
			"</Table>",
		].join("\n");
		const json = tiptapOf(source);
		const row0 = json.content?.[0]?.content?.[0];
		expect(row0?.content?.[0]?.attrs?.colspan).toBe(2);
		expect(mdxOfTiptap(json).trim()).toBe(source);
	});

	it("writes a GFM table with a merged cell as an element table", () => {
		const json = tiptapOf(["| a | b |", "| :-- | :-: |", "| 1 | 2 |"].join("\n"));
		const row = json.content?.[0]?.content?.[0];
		const [first, second] = row?.content ?? [];
		// What `mergeCells` leaves: one cell spanning both columns.
		if (!row || !first || !second) throw new Error("no cells");
		row.content = [{ ...first, attrs: { ...first.attrs, colspan: 2 } }];
		const written = mdxOfTiptap(json).trim();
		expect(written).toContain("<Table");
		expect(written).toContain('colspan="2"');
	});

	it("writes a table without merged cells back as GFM", () => {
		const json = tiptapOf(
			[
				'<Table align="left,center">',
				"<TableRow>",
				'<TableCell header colspan="2">제목</TableCell>',
				"</TableRow>",
				"<TableRow>",
				"<TableCell>1</TableCell>",
				"<TableCell>2</TableCell>",
				"</TableRow>",
				"</Table>",
			].join("\n"),
		);
		// What `splitCell` leaves: the spans are gone, and the first row has its two header cells.
		const [head, body] = json.content?.[0]?.content ?? [];
		const cell = head?.content?.[0];
		if (!head || !cell || !body) throw new Error("no cells");
		head.content = [
			{ ...cell, attrs: { ...cell.attrs, colspan: 1 } },
			{ type: "tableHeader", content: [{ type: "paragraph" }] },
		];
		const written = mdxOfTiptap(json).trim();
		expect(written).not.toContain("<Table");
		expect(written).toContain("| 제목 |");
	});

	it("keeps a first-column header layout as an element table", () => {
		const source = [
			"<Table>",
			"<TableRow>",
			"<TableCell header>이름</TableCell>",
			"<TableCell>값</TableCell>",
			"</TableRow>",
			"<TableRow>",
			"<TableCell header>나이</TableCell>",
			"<TableCell>3</TableCell>",
			"</TableRow>",
			"</Table>",
		].join("\n");
		expect(roundTrip(source).trim()).toBe(source);
	});

	it("loads column widths as cell colwidth and saves adjusted widths as widths", () => {
		const source = [
			'<Table widths="80,160">',
			"<TableRow>",
			'<TableCell header colspan="2">합친 머리글</TableCell>',
			"</TableRow>",
			"<TableRow>",
			"<TableCell>a</TableCell>",
			"<TableCell>b</TableCell>",
			"</TableRow>",
			"</Table>",
		].join("\n");
		const json = tiptapOf(source);
		const rows = json.content?.[0]?.content;
		expect(rows?.[0]?.content?.[0]?.attrs?.colwidth).toEqual([80, 160]);
		expect(rows?.[1]?.content?.[1]?.attrs?.colwidth).toEqual([160]);
		expect(mdxOfTiptap(json).trim()).toBe(source);

		// Adjusting a column width in a GFM table without merges saves an element table with the header made explicit.
		const gfm = tiptapOf(["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n"));
		const firstCell = gfm.content?.[0]?.content?.[0]?.content?.[0];
		if (!firstCell) throw new Error("no cell");
		firstCell.attrs = { ...firstCell.attrs, colwidth: [150] };
		expect(mdxOfTiptap(gfm).trim()).toBe(
			[
				'<Table widths="150">',
				"<TableRow>",
				"<TableCell header>a</TableCell>",
				"<TableCell header>b</TableCell>",
				"</TableRow>",
				"<TableRow>",
				"<TableCell>1</TableCell>",
				"<TableCell>2</TableCell>",
				"</TableRow>",
				"</Table>",
			].join("\n"),
		);
	});
});

describe("container blocks", () => {
	it.each([
		'<Callout variant="note">\n\n강조 **문장**\n\n</Callout>',
		'<Collapsible title="제목">\n\n본문\n\n</Collapsible>',
		'<Tabs>\n\n<Tab label="a">\n\n첫째\n\n</Tab>\n\n<Tab label="b">\n\n둘째\n\n</Tab>\n\n</Tabs>',
		"<Columns>\n\n<Column>\n\n왼쪽\n\n</Column>\n\n<Column>\n\n오른쪽\n\n</Column>\n\n</Columns>",
		'<Columns widths="60,40">\n\n<Column>\n\n왼쪽\n\n</Column>\n\n<Column>\n\n오른쪽\n\n</Column>\n\n</Columns>',
		'<CodeExplorer open="a.ts">\n\n```ts title="a.ts"\nconst a = 1;\n```\n\n```text title="dir/"\n\n```\n\n</CodeExplorer>',
	])("round-trips %s", (source) => {
		expect(roundTrip(source).trim()).toBe(mdxOfDoc(docOfMdx(source)).trim());
		expect(JSON.stringify(tiptapOf(source))).not.toContain(OPAQUE_BLOCK_NAME);
	});

	it("writes a callout without a body as a self-closing element", () => {
		const source = '<Callout variant="info" title="제목만" />';
		const json = tiptapOf(source);
		expect(json.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
		expect(mdxOfTiptap(json).trim()).toBe(mdxOfDoc(docOfMdx(source)).trim());
	});

	it("opens an empty container, a Tab outside its parent and a Column outside its parent as a source box", () => {
		expect(tiptapOf('<Collapsible title="a" />').content?.[0]?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapOf('<Tab label="a">\n\n본문\n\n</Tab>').content?.[0]?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapOf("<Column>\n\n본문\n\n</Column>").content?.[0]?.type).toBe(OPAQUE_BLOCK_NAME);
	});
});

describe("marks", () => {
	it("round-trips a tooltip whose label contains a closing bracket", () => {
		const mdx = '<Tooltip content="설명">a]b</Tooltip>\n';
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("round-trips a tooltip inside a sentence", () => {
		const mdx = '본문 속 <Tooltip content="상세 설명">단어</Tooltip> 확인하기\n';
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("writes a block of untranslated text as the notice element, and an empty one as nothing", () => {
		const mdx = "F\n\n<Untranslated>둘째 문단</Untranslated>\n";
		expect(roundTrip(mdx)).toBe(mdx);
		expect(roundTrip("<Untranslated>첫 문단</Untranslated>\n")).toBe("<Untranslated>첫 문단</Untranslated>\n");
	});

	it("reads an internal link as the id of its entry and writes the id back", () => {
		const id = "123e4567-e89b-42d3-a456-426614174000";
		const mdx = `A [post](entry:${id}) and [site](https://example.com "T").\n`;
		expect(roundTrip(mdx)).toBe(mdx);
	});
});

describe("custom blocks", () => {
	it("round-trips a block with an editor node, a raw-source box and a code fence block", () => {
		for (const mdx of [
			'<Notice level="warn" title="점검">\n\n오늘 밤 점검합니다.\n\n</Notice>\n',
			'<Embed url="https://example.com/video" />\n',
			"```mermaid title=흐름\ngraph TD\n  A --> B\n```\n",
		]) {
			expect(roundTrip(mdx)).toBe(mdx);
		}
		expect(tiptapOf('<Embed url="https://example.com/video" />\n').content?.[0]?.type).toBe(OPAQUE_BLOCK_NAME);
	});
});

describe("code blocks", () => {
	it("round-trips code links and the line label they point to", () => {
		const mdx = [
			'Read <CodeRef to="c1">the sum</CodeRef>.',
			"",
			"```ts",
			"const a = 1;",
			'// @line anchor {1-1} id="c1"',
			"const b = a + 1;",
			"```",
			"",
		].join("\n");
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("writes the annotations of a code block as comments, in one canonical order", () => {
		const mdx = [
			"```ts",
			"// @line plus {0-0}",
			"// @line collapse {1-2}",
			"// @document strong {re:/const/g}",
			"// @document fold {re:/b/g}",
			'// @char Tooltip {0-5} content="설명"',
			"const a = 1;",
			"const b = 2;",
			"const c = 3;",
			"```",
			"",
		].join("\n");
		const written = roundTrip(mdx);
		for (const comment of mdx.split("\n").filter((line) => line.startsWith("// @"))) expect(written).toContain(comment);
		expect(roundTrip(written)).toBe(written);
	});
});

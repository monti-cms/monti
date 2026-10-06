import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import { resolveImageUrl } from "../../mdx/image-src";
import { bodyFromMdx } from "../../mdx/stored-document";
import { type ParityOptions, renderBoth, stubComponents } from "./parity";

/**
 * The matrix: every node, mark and block of the stored document, rendered by `renderDocument` and by `renderMdx` (from the MDX written from the same
 * document). `parity.tsx` lists what the comparison normalizes. Blocks of the site config are drawn by stand-in components here; the real ones are
 * compared in `@monti-cms/blocks`. Runs with every test site config.
 */

const stubs = stubComponents();

const check = async (source: string, options: ParityOptions = {}) => {
	expect(bodyFromMdx(source).doc, "the source is stored as a document").not.toBeNull();
	const parity = await renderBoth(source, { ...stubs, ...options });
	expect(parity.document).toBe(parity.mdx);
	expect(parity.tocDocument).toEqual(parity.tocMdx);
	expect(parity.unknown).toBe(0);
	return parity;
};

/** Like the public resolver: a media id from the library, an outer address by the allow rules. */
const IMAGE_RESOLVER: ParityOptions["imageResolver"] = ({ mediaId, src }) => {
	if (mediaId === "m1") return { url: "https://cdn.example/m1.png", width: 640, height: 480 };
	if (mediaId === "pdf") {
		return {
			url: "https://cdn.example/a.pdf",
			file: { filename: "deck.pdf", byteSize: 2_516_582, mimeType: "application/pdf" },
		};
	}
	return (mediaId ? undefined : resolveImageUrl(src)) ?? { failure: "unresolved" };
};

const MATRIX: Record<string, string> = {
	// ---- text and breaks
	"paragraphs and a soft newline": "첫 문단\n\n둘째 줄\n이어서",
	"hard breaks": "첫 줄<br />\n둘째 줄<br />\n셋째 줄",
	"one blank line": "앞\n\n<br />\n\n뒤",
	"two blank lines": "앞\n\n<br />\n\n<br />\n\n뒤",
	"four blank lines": "앞\n\n<br />\n\n<br />\n\n<br />\n\n<br />\n\n뒤",
	"escaped characters": "별표 \\* 와 밑줄 \\_ 와 대괄호 \\[x\\] 와 $달러 와 백틱 \\`",
	// ---- marks
	"every simple mark": "**굵게** *기울임* ~~취소~~ <u>밑줄</u> <sup>위</sup> <sub>아래</sub> `코드`",
	"nested marks": "**굵게 *기울임* 다시 굵게** 와 *기울임 **굵게** 기울임* 와 ~~**취소**~~",
	"a mark that spans a link": "**앞 [링크](/a) 뒤** 그리고 [**굵은 링크**](https://example.com)",
	"adjacent marks": "**a**b**c** 와 *x**y***",
	"emphasis next to punctuation": "**정적(Static)**과 **“인용”**을 쓴다",
	"underline around bold": "<u>**굵은 밑줄**</u> 와 <sup>*위*</sup>",
	"inline code with marks": "**굵게 `코드` 굵게** 그리고 `a * b`",
	// ---- links
	"links of every kind":
		'[사이트](/a) [밖](https://example.com "제목") [메일](mailto:a@b.c) [전화](tel:123) [앵커](#x) [상대](./a/b) [나쁜](javascript:alert(1)) [빈]()',
	"links with a rewriter": "[안](/a) [밖](https://example.com) [앵커](#top)",
	// ---- headings
	"heading levels": "# 하나\n\n## 둘\n\n### 셋\n\n#### 넷\n\n##### 다섯\n\n###### 여섯",
	"repeated headings": "## 같은 제목\n\n본문\n\n## 같은 제목\n\n### 같은 제목\n\n## 같은 제목 1",
	"headings with marks and punctuation":
		"## 제목 `코드` **굵게** [링크](/a)!\n\n### 한글 제목 (괄호) & 기호?\n\n## Hello, World",
	"heading with only an image": "## ![](/a.png)",
	// ---- blocks
	"quotes and rules": "> 인용\n>\n> 둘째 문단\n\n---\n\n> 바깥\n>\n> > 안쪽\n\n***",
	"a quote with a list": "> 목록:\n>\n> - 하나\n> - 둘",
	"text alignment":
		'<TextAlign align="center">\n\n가운데\n\n</TextAlign>\n\n<TextAlign align="right">\n\n오른쪽 **굵게**\n\n</TextAlign>',
	"text alignment that is not allowed": '<TextAlign align="justify">\n\n무시\n\n</TextAlign>',
	// ---- lists
	"bullet lists": "- 하나\n- 둘\n- 셋",
	"nested lists": "- 하나\n  - 안쪽\n    - 더 안쪽\n- 둘",
	"ordered lists": "1. 하나\n2. 둘\n3. 셋",
	"an ordered list that starts later": "3. 셋\n4. 넷",
	"a loose list": "- 하나\n\n  이어서\n- 둘",
	"a list with a code block": "- 코드:\n\n  ```ts\n  const a = 1;\n  ```\n- 끝",
	"task lists": "- [ ] 할 일\n- [x] 한 일\n- [ ] **굵은** 할 일",
	"a loose task list": "- [x] 하나\n\n  이어서\n- [ ] 둘",
	"an empty item": "- 하나\n-\n- 셋",
	// ---- code
	"a code block": "```ts\nconst a = 1;\nconsole.log(a);\n```",
	"a code block without a language": "```\nplain text\n```",
	"a code block with an unknown language": "```nolang\nsome code\n```",
	"a code block with a title and line numbers": '```ts title="src/a.ts" lnum\nconst a = 1;\n```',
	"an empty code block": "```ts\n```",
	"code with line effects":
		"```ts\n// @line highlight {0-1}\nconst a = 1;\nconst b = 2;\n// @line plus\nconst c = 3;\n// @line minus\nconst d = 4;\n```",
	"code with a collapsed range": "```ts\n// @line collapse {0-2}\nfunction f() {\n  return 1;\n}\nf();\n```",
	"code with text effects":
		'```ts\n// @char strong {0-5}\n// @char u {6-7}\nconst a = 1;\n// @char Tooltip {6-7} content="설명"\nconst b = 2;\n// @char fold {0-5}\nconst c = 3;\n```',
	"code with a line label": '```ts\n// @line anchor {0-1} id="c1"\nconst a = 1;\nconst b = 2;\n```',
	"code in a list and a quote": "> ```ts\n> const a = 1;\n> ```\n\n- ```ts\n  const b = 2;\n  ```",
	"code with a regex rule": "```ts\n// @char strong {re:/const/}\nconst a = 1;\nconst b = 2;\n```",
	// ---- images and files
	"a markdown image": '![설명](/images/a.png "제목")\n\n문장 속 ![작은](/images/b.png) 그림',
	"an image": '<Image src="/images/a.png" alt="설명" caption="캡션" width="60%" />',
	"an image with every option":
		'<Image src="/images/a.png" alt="설명" caption="캡션" width="320px" align="right" crop="10,10,50,50" rotate="90" title="제목" />',
	"a decorative image": '<Image src="/images/a.png" decorative />',
	"an image from the media library": '<Image mediaId="m1" alt="a" />',
	"an image that cannot be resolved": '<Image mediaId="missing" alt="대체" caption="캡션" />',
	"an image with an address that is not allowed": '<Image src="javascript:alert(1)" alt="대체" caption="캡션" />',
	"an image with a width that is not allowed": '<Image src="/images/a.png" alt="a" width="200%" align="middle" />',
	"an image with only an alignment that is not allowed": '<Image src="/images/a.png" alt="a" align="middle" />',
	"a file": '<File mediaId="pdf" label="발표 자료" />',
	"a file that cannot be resolved": '<File mediaId="missing" label="발표 자료" />',
	// ---- tables
	"a table": "| 이름 | 값 |\n| --- | --- |\n| a | 1 |\n| b | 2 |",
	"a table with alignment": "| 왼 | 가운데 | 오른 |\n|:--|:-:|--:|\n| 1 | 2 | 3 |",
	"a table with marks in cells": "| **굵게** | `코드` |\n| --- | --- |\n| [링크](/a) | <u>밑줄</u> |",
	"a table with merged cells":
		'<Table>\n<TableRow><TableCell header>A</TableCell><TableCell header>B</TableCell></TableRow>\n<TableRow><TableCell colspan="2">합침</TableCell></TableRow>\n</Table>',
	"a table with a row span":
		'<Table>\n<TableRow><TableCell header>A</TableCell><TableCell>B</TableCell></TableRow>\n<TableRow><TableCell header rowspan="2">행</TableCell><TableCell>1</TableCell></TableRow>\n<TableRow><TableCell>2</TableCell></TableRow>\n</Table>',
	"a table with widths and alignment":
		'<Table align="left,right" widths="100,200">\n<TableRow><TableCell header>A</TableCell><TableCell header>B</TableCell></TableRow>\n<TableRow><TableCell>1</TableCell><TableCell>2</TableCell></TableRow>\n</Table>',
	"a table with some widths":
		'<Table widths=",200">\n<TableRow><TableCell header>A</TableCell><TableCell header>B</TableCell></TableRow>\n<TableRow><TableCell>1</TableCell><TableCell>2</TableCell></TableRow>\n</Table>',
	"a table with header cells in the first column":
		"<Table>\n<TableRow><TableCell>A</TableCell><TableCell>B</TableCell></TableRow>\n<TableRow><TableCell header>행</TableCell><TableCell>1</TableCell></TableRow>\n<TableRow><TableCell header>행</TableCell><TableCell>2</TableCell></TableRow>\n</Table>",
	// ---- math
	"block math": "$$\nx^2 + y^2 = z^2\n$$\n\n문장 속 $달러$ 는 그대로",
	"math KaTeX cannot read": "$$\n\\frac{1\n$$",
	"a formula with a command": "$$\n\\sum_{i=1}^{n} \\sqrt{i}\n$$",
	// ---- footnotes
	footnotes: "첫째[^1] 와 둘째[^note] 와 다시 첫째[^1].\n\n[^1]: 첫 출처.\n\n[^note]: 링크 [a](/docs/a) 와 `code`.",
	"a footnote whose definition has several blocks":
		"본문[^a]\n\n[^a]: 첫 문단\n\n    둘째 문단\n\n    ```ts\n    const a = 1;\n    ```",
	"footnotes referenced out of order": "하나[^b] 둘[^a]\n\n[^a]: A\n[^b]: B",
	"a footnote reference without a definition": "정의 없는 참조[^none] 와 [^x]",
	"a footnote definition nobody refers to": "본문\n\n[^unused]: 안 쓰임",
	"a heading and a footnote": "## 제목\n\n본문[^1]\n\n[^1]: 각주",
	// ---- mixed
	"a long mixed post": [
		"# 제목",
		"",
		"소개 문단 **굵게** 그리고 [링크](https://example.com)[^1].",
		"",
		"## 목록",
		"",
		"- 하나",
		"  - 안쪽",
		"- 둘",
		"",
		"## 코드",
		"",
		'```ts title="a.ts"',
		"const a = 1;",
		"```",
		"",
		"> 인용",
		"",
		"| a | b |",
		"| - | - |",
		"| 1 | 2 |",
		"",
		"[^1]: 각주",
	].join("\n"),
};

describe("JSON renderer parity with renderMdx: the node matrix", () => {
	for (const [name, source] of Object.entries(MATRIX)) {
		it(`renders ${name} the same`, async () => {
			await check(source, {
				imageResolver: IMAGE_RESOLVER,
				resolveHref: (href) => (href === "/a" ? "/en/a" : href),
				labels: { imageUnavailable: "표시할 수 없음", fileUnavailable: "파일 없음" },
			});
		});
	}

	it("renders the table of contents with the same anchors and depths", async () => {
		const parity = await check("# 제목\n\n## 둘\n\n### 셋\n\n#### 넷\n\n## 둘\n\n본문[^1]\n\n[^1]: 각주");
		expect(parity.tocDocument.map((item) => item.href)).toEqual(["#둘", "#셋", "#둘-1"]);
		expect(parity.tocDocument.map((item) => item.depth)).toEqual([0, 1, 0]);
	});

	const fence = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");
	it.skipIf(!fence)("passes a code fence block to its component as the original source", async () => {
		const block = fence as NonNullable<typeof fence>;
		const lang = block.syntax.kind === "fence" ? block.syntax.lang : "";
		const parity = await check(`\`\`\`${lang}\nA -> B\n\`\`\``);
		expect(parity.document).toContain('data-source="A -> B"');
	});

	const container = ADDED_BLOCKS.find(
		(block) => block.syntax.kind === "container" && !block.parent && !block.children?.blocks,
	);
	it.skipIf(!container)("renders a container block with attributes, content and nesting", async () => {
		const block = container as NonNullable<typeof container>;
		const [attribute] = Object.entries(block.attributes).filter(([, definition]) => definition.type === "string");
		// A value the definition allows (an out-of-set choice is replaced by the default, which the stand-in does not print).
		const value = Object.keys(attribute?.[1].options ?? {})[0] ?? "값";
		const attrs = attribute ? ` ${attribute[0]}="${value}"` : "";
		const source = `<${block.component}${attrs}>\n\n안 **굵게**\n\n- 목록\n\n<${block.component}>\n\n더 안\n\n</${block.component}>\n\n</${block.component}>`;
		const parity = await check(source);
		expect(parity.document).toContain(`data-stub="${block.name}"`);
	});
});

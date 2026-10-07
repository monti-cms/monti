import { readFileSync } from "node:fs";
import path from "node:path";
import { bodyFromMdx } from "@monti-cms/mdx/format";
import { readSamples, renderFixture } from "@monti-cms/mdx/testing";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { describe, expect, it } from "vitest";
import { renderSite as site } from "../test/render-config";

/** MDX text is read into a stored document and drawn with the real block components: nothing is left to the fallback. */
const syntax = [directiveSyntax()];

const expectRenders = async (
	source: string,
	label: string,
	options: Omit<Parameters<typeof renderFixture>[1], "site"> = {},
) => {
	const rendered = await renderFixture(source, { site, syntax, ...options });
	expect(rendered.unknown, label).toEqual([]);
	return rendered;
};

describe("rendering of block extensions", () => {
	it("renders every sample post without unknown nodes", async () => {
		const samples = readSamples();
		expect(samples.length).toBeGreaterThan(0);
		for (const { name, mdx } of samples) {
			expect(bodyFromMdx(site, mdx, syntax).doc, name).not.toBeNull();
			await expectRenders(mdx, name);
		}
	});

	it("renders the component showcase in every locale", async () => {
		const source = readFileSync(path.join(__dirname, "fixtures/component-showcase.mdx"), "utf8");
		for (const locale of [undefined, "ko", "en"]) {
			const rendered = await expectRenders(source, `showcase ${locale}`, { locale });
			// It holds every block of the extension, so a block the renderer skipped would be missing here.
			for (const marker of ["cms-block-callout", "cms-block-collapsible", "cms-block-columns", 'role="tablist"']) {
				expect(rendered.html).toContain(marker);
			}
		}
	});

	const cases: Record<string, string> = {
		"callout variants": [
			':::callout{variant="warning" title="주의"}\n본문 **굵게**\n:::',
			':::callout{variant="tip"}\n내용\n:::',
			":::callout\n기본\n:::",
			':::callout{variant="danger" title="제목만"}\n:::',
		].join("\n\n"),
		collapsible: [':::collapsible{title="더 보기" defaultOpen}\n숨은 내용\n:::', ":::collapsible\n제목 없음\n:::"].join(
			"\n\n",
		),
		"tabs with a default tab":
			'::::tabs{defaultValue="둘째"}\n:::tab{label="첫째"}\n첫 내용\n:::\n:::tab{label="둘째"}\n둘째 내용\n\n- 목록\n:::\n::::',
		"tabs whose default matches nothing":
			'::::tabs{defaultValue="없음"}\n:::tab{label="a"}\nA\n:::\n:::tab{label="b"}\nB\n:::\n::::',
		columns: ":::::columns\n::::column\n왼쪽\n::::\n::::column\n가운데\n::::\n::::column\n오른쪽\n::::\n:::::",
		"columns with widths": ':::::columns{widths="60,40"}\n::::column\n왼쪽\n::::\n::::column\n오른쪽\n::::\n:::::',
		"columns with widths that do not fit":
			':::::columns{widths="60,40,10"}\n::::column\n왼쪽\n::::\n::::column\n오른쪽\n::::\n:::::',
		tooltip: '문장 속 :tooltip[툴팁]{content="설명입니다"} 이후 **:tooltip[굵은]{content="설명"}** 글.',
		color:
			'빨간 :color[경고]{fg="#dc2626" fgDark="#f87171"}와 :color[**강조**]{bg="#fef3c7" bgDark="#453a12"} 그리고 :color[나쁜]{fg="red"}.',
		mermaid: "```mermaid\ngraph TD\n  A --> B\n```",
		"chart with a valid body":
			"```chart\nchart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200\n```",
		"chart with a syntax error": "```chart\nthis is not a chart\n```",
		"code explorer": [
			':::code-explorer{open="src/b.ts"}',
			'```ts title="src/a.ts"',
			"const a = 1;",
			"```",
			'```ts title="src/b.ts"',
			"const b = 2;",
			"```",
			'```text title="public/"',
			"```",
			":::",
		].join("\n"),
		"code explorer with duplicates and other content": [
			":::code-explorer",
			"앞 문단",
			'```ts title="a.ts"',
			"one",
			"```",
			'```ts title="a.ts"',
			"two",
			"```",
			'```ts title="a.ts/"',
			"folder with code",
			"```",
			"```ts",
			"no path",
			"```",
			":::",
		].join("\n"),
		"empty code explorer": ":::code-explorer\n:::",
		"code link with a code anchor": [
			'이 :code-ref[함수가]{to="c1"} 값을 돌려준다.',
			"",
			"```ts",
			'// @line anchor {1-2} id="c1"',
			"function add(a, b) {",
			"  const sum = a + b;",
			"  return sum;",
			"}",
			"```",
		].join("\n"),
		"blocks inside blocks":
			':::::callout{variant="info" title="안"}\n::::tabs\n:::tab{label="a"}\n```ts title="x.ts"\nconst x = 1;\n```\n:::\n:::tab{label="b"}\n:tooltip[설명]{content="내용"}\n:::\n::::\n:::::',
	};

	for (const [name, source] of Object.entries(cases)) {
		it(`renders ${name}`, async () => {
			expect(bodyFromMdx(site, source, syntax).doc, name).not.toBeNull();
			await expectRenders(source, name);
		});
	}
});

import { renderMdx } from "@monti-cms/mdx/render";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderSite as site } from "../test/render-config";

/** The directive notation is opt-in (`mdx.syntax`), so these tests pass the extension explicitly. */
const syntax = [directiveSyntax()];

const renderPublic = async (source: string): Promise<string> =>
	renderToStaticMarkup((await renderMdx(source, { site, syntax })).content);

describe("directive render equivalence — directive notation vs. standard notation", () => {
	it("directives render the same as the standard MDX notation of the same content", async () => {
		const pairs: [string, string][] = [
			[
				':::callout{variant="tip" title="제목"}\n본문 **굵게**\n:::',
				'<Callout variant="tip" title="제목">\n\n본문 **굵게**\n\n</Callout>',
			],
			[':::callout{variant="note" title="제목만"}\n:::', '<Callout variant="note" title="제목만" />'],
			[
				'::::tabs{defaultValue="B"}\n:::tab{label="A"}\na\n:::\n:::tab{label="B"}\nb\n:::\n::::',
				'<Tabs defaultValue="B">\n\n<Tab label="A">\n\na\n\n</Tab>\n\n<Tab label="B">\n\nb\n\n</Tab>\n\n</Tabs>',
			],
			[
				':::code-explorer{open="a.ts"}\n```ts title="a.ts"\nconst a = 1;\n```\n```text title="dir/"\n```\n:::',
				'<CodeExplorer open="a.ts">\n\n```ts title="a.ts"\nconst a = 1;\n```\n\n```text title="dir/"\n```\n\n</CodeExplorer>',
			],
			[":u[밑줄]과 :sup[위]와 :sub[아래]", "<u>밑줄</u>과 <sup>위</sup>와 <sub>아래</sub>"],
			["첫 줄:br[]둘째 줄", "첫 줄<br />\n둘째 줄"],
			[':tooltip[용어]{content="뜻풀이"}를 본다', '<Tooltip content="뜻풀이">용어</Tooltip>를 본다'],
			['글자 :color[빨강]{fg="#dc2626" fgDark="#f87171"}', '글자 <Color fg="#dc2626" fgDark="#f87171">빨강</Color>'],
			[
				"::::table\n:::row\n::cell[a]{header colspan=2}\n:::\n:::row\n::cell[b]\n::cell[c]\n:::\n::::",
				'<Table>\n<TableRow>\n<TableCell header colspan="2">a</TableCell>\n</TableRow>\n<TableRow>\n<TableCell>b</TableCell>\n<TableCell>c</TableCell>\n</TableRow>\n</Table>',
			],
		];

		for (const [directive, standard] of pairs) {
			const fromStandard = renderToStaticMarkup((await renderMdx(standard, { site })).content);
			expect(fromStandard, standard).not.toBe("");
			expect(await renderPublic(directive), directive).toBe(fromStandard);
		}
	});
});

describe("directive render (core default components)", () => {
	it("renders a forced line break as :br[] (a form that stays safe when Korean text follows)", async () => {
		// A name swallows the characters that follow it. Hangul counts as name characters too, so `:br둘째` becomes the name `br둘째`,
		// is treated as unregistered, and the `:br` text is output as is. So serialization always adds an empty label.
		const safe = await renderPublic("첫 줄:br[]둘째 줄");
		const ambiguous = await renderPublic("첫 줄:br둘째 줄");

		expect(safe).toContain("<br/>");
		expect(safe).not.toContain(":br");
		expect(ambiguous).toContain(":br둘째");
		expect(ambiguous).not.toContain("<br/>");
	});

	it("an unresolvable image leaves only a neutral placeholder and the caption", async () => {
		const unresolved = await renderPublic(
			'::image{mediaId="00000000-0000-0000-0000-000000000000" alt="대체텍스트" caption="캡션"}',
		);
		const rejected = await renderPublic('::image{src="javascript:alert(1)" alt="대체텍스트" caption="캡션"}');
		const noCaption = await renderPublic('::image{mediaId="00000000-0000-0000-0000-000000000000"}');

		for (const html of [unresolved, rejected, noCaption]) {
			expect(html).not.toContain("<img");
			// Do not substitute the internal failure reason or the alt text. width and align are not applied either.
			expect(html).toContain("cms-image-unavailable");
			expect(html).not.toContain("대체텍스트");
			expect(html).not.toContain("width:");
		}
		expect(unresolved).toContain("캡션");
		expect(rejected).toContain("캡션");
		expect(noCaption).not.toContain("<figcaption");
	});

	it("an unregistered name stays as body text, and an unregistered container is kept as source but not drawn", async () => {
		const inline = await renderPublic("openai/gpt-oss-120b:free를 쓴다.");
		const container = await renderPublic(":::unknown\n안쪽 :free를 그대로\n:::");

		expect(inline).toContain("gpt-oss-120b:free를");
		// The container is stored as raw source (nothing is lost on save), and the public page does not draw raw source.
		expect(container).not.toContain("안쪽");
		expect(container).toContain("data-cms-unknown");
	});
});

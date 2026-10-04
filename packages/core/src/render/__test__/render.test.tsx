import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import { renderMdx } from "../index";

const html = async (source: string, options?: Parameters<typeof renderMdx>[1]) =>
	renderToStaticMarkup((await renderMdx(source, options)).content);

/** The first code fence block in the config (chart, diagram etc.). */
const fenceBlock = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");

/** Body rendering. The reference blog's public render checks were moved to the core default components (runs with two configs). */
describe("body rendering @monti-cms/core/render", () => {
	it("renders Markdown, tables, line breaks and the table of contents", async () => {
		const rendered = await renderMdx("## 제목\n\n첫 줄\n둘째 줄\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");
		const markup = renderToStaticMarkup(rendered.content);
		expect(markup).toContain('<h2 id="제목">');
		expect(markup).toContain("<br/>");
		expect(markup).toContain("<table");
		expect(rendered.toc).toEqual([expect.objectContaining({ value: "제목", depth: 0 })]);
	});

	it("does not render a body that fails the check", async () => {
		await expect(renderMdx("<Unclosed>")).rejects.toThrow(/MDX validation failed/);
	});

	it("renders inline directives and line break directives as elements", async () => {
		const markup = await html("밑줄은 :u[밑줄] 위는 :sup[위] 아래는 :sub[아래] 첫 줄:br[]둘째 줄");
		expect(markup).toContain("<u>밑줄</u>");
		expect(markup).toContain("<sup>위</sup>");
		expect(markup).toContain("<sub>아래</sub>");
		expect(markup).toContain("<br/>");
	});

	it(":::text-align turns only validated alignments into classes", async () => {
		expect(await html(':::text-align{align="center"}\n가운데\n:::')).toContain('class="cms-align-center"');
		expect(await html(':::text-align{align="justify"}\n무시\n:::')).not.toContain("cms-align-justify");
	});

	it("::image renders the address, alt text, caption and width, and if unresolved only an empty slot and the caption remain", async () => {
		const ok = await html('::image{src="/images/a.png" alt="설명" caption="캡션" width="60%"}');
		expect(ok).toContain('src="/images/a.png"');
		expect(ok).toContain('alt="설명"');
		expect(ok).toContain("캡션");
		expect(ok).toContain("width:60%");

		const unresolved = await html('::image{src="javascript:alert(1)" alt="대체" caption="캡션"}', {
			labels: { imageUnavailable: "표시할 수 없음" },
		});
		expect(unresolved).not.toContain("<img");
		expect(unresolved).toContain("표시할 수 없음");
		expect(unresolved).not.toContain("대체");
		expect(unresolved).toContain("캡션");
	});

	it("accepts an image resolver and a link rewriter", async () => {
		const markup = await html(
			'::image{mediaId="m1" alt="a"}\n\n[안](/a) [밖](https://example.com) [나쁜](javascript:x)',
			{
				imageResolver: ({ mediaId }) =>
					mediaId === "m1" ? { url: "https://cdn.example/m1.png", width: 10, height: 5 } : { failure: "unresolved" },
				resolveHref: (href) => (href === "/a" ? "/en/a" : href),
			},
		);
		expect(markup).toContain('src="https://cdn.example/m1.png"');
		expect(markup).toContain('href="/en/a"');
		expect(markup).toContain('class="cms-link-external"');
		expect(markup).not.toContain("javascript:");
	});

	it("::file renders the name, type, size and a download link, and if unresolved only the name remains", async () => {
		const source = '::file{mediaId="11111111-1111-4111-8111-111111111111" label="발표 자료"}';
		const ok = await html(source, {
			imageResolver: () => ({
				url: "https://cdn.example/a.pdf",
				file: { filename: "deck.pdf", byteSize: 2_516_582, mimeType: "application/pdf" },
			}),
		});
		expect(ok).toContain("발표 자료");
		expect(ok).toContain("PDF · 2.4MB");
		expect(ok).toMatch(/<a href="https:\/\/cdn\.example\/a\.pdf" download="deck\.pdf"/);

		const unresolved = await html(source, { labels: { fileUnavailable: "파일 없음" } });
		expect(unresolved).toContain("발표 자료");
		expect(unresolved).toContain("파일 없음");
		expect(unresolved).not.toContain("<a ");
	});

	it("highlights code fences and leaves unregistered directives as body text", async () => {
		const code = await html("```ts\nconst a = 1;\n```");
		expect(code).toContain('class="shiki');
		expect(await html("openai/gpt-oss-120b:free를 쓴다.")).toContain("gpt-oss-120b:free를");
	});

	it.skipIf(!fenceBlock)(
		"passes a code fence block to the block component as the original source, and the site can override the component",
		async () => {
			const block = fenceBlock as NonNullable<typeof fenceBlock>;
			const lang = block.syntax.kind === "fence" ? block.syntax.lang : "";
			const markup = await html(`\`\`\`${lang}\nA -> B\n\`\`\``, {
				components: { [block.component]: ({ source }: { source: string }) => <output data-source={source} /> },
			});
			expect(markup).toContain('data-source="A -&gt; B"');
		},
	);
});

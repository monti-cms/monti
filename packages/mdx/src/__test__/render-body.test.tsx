import { ADDED_BLOCKS } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import type { RenderMdxOptions } from "../render";
import { insertSoftBreaks, renderFixture } from "../testing";

const html = async (source: string, options?: RenderMdxOptions) => (await renderFixture(source, options)).html;

/** The first code fence block in the config (chart, diagram etc.). */
const fenceBlock = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");

/** Rendering of MDX text (`renderMdx`): the text is read by the mdx format and drawn by core's document renderer. */
describe("renderMdx", () => {
	it("renders Markdown, tables, line breaks and the table of contents", async () => {
		const rendered = await renderFixture("## 제목\n\n첫 줄<br />\n둘째 줄\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");
		const markup = rendered.html;
		expect(markup).toContain('<h2 id="제목"');
		expect(markup).toContain("<br/>");
		expect(markup).toContain("<table");
		expect(rendered.toc).toEqual([expect.objectContaining({ value: "제목", depth: 0 })]);
	});

	it("renders a single newline inside a paragraph as a space, as CommonMark and the CMS tree read it", async () => {
		const markup = await html("첫 줄\n둘째 줄");
		expect(markup).not.toContain("<br");
		expect(markup).toContain("첫 줄\n둘째 줄");
	});

	it("looks the same after the soft-break migration as the old chain did: a break where there was a newline", async () => {
		const source = "첫 줄\n둘째 줄\n셋째 줄\n\n- 항목\n  이어서";
		const result = insertSoftBreaks(source);
		if (result.status !== "changed") throw new Error("expected a change");
		const markup = await html(result.mdx);
		// Two breaks in the paragraph and one in the list item; the line endings after the breaks add no more.
		expect(markup.match(/<br\/>/g)).toHaveLength(3);
	});

	it("does not render a body that fails the check", async () => {
		await expect(renderFixture("<Unclosed>")).rejects.toThrow(/MDX validation failed/);
	});

	it("renders underline, superscript, subscript and line break elements", async () => {
		const markup = await html("밑줄은 <u>밑줄</u> 위는 <sup>위</sup> 아래는 <sub>아래</sub> 첫 줄<br />\n둘째 줄");
		expect(markup).toContain("<u>밑줄</u>");
		expect(markup).toContain("<sup>위</sup>");
		expect(markup).toContain("<sub>아래</sub>");
		expect(markup).toContain("<br/>");
		// The line ending the serializer writes after `<br />` is not a second break.
		expect(markup.match(/<br\/>/g)).toHaveLength(1);
	});

	it.each([1, 2, 4])("renders %i blank lines between blocks as that many line breaks between them", async (count) => {
		const markup = await html(`앞\n\n${"<br />\n\n".repeat(count)}뒤`);
		expect(markup.replace(/\n/g, "")).toBe(`<p>앞</p>${"<br/>".repeat(count)}<p>뒤</p>`);
	});

	it("<TextAlign> turns only validated alignments into classes", async () => {
		expect(await html('<TextAlign align="center">\n\n가운데\n\n</TextAlign>')).toContain('class="cms-align-center"');
		expect(await html('<TextAlign align="justify">\n\n무시\n\n</TextAlign>')).not.toContain("cms-align-justify");
	});

	it("<Image> renders the address, alt text, caption and width, and if unresolved only an empty slot and the caption remain", async () => {
		const ok = await html('<Image src="/images/a.png" alt="설명" caption="캡션" width="60%" />');
		expect(ok).toContain('src="/images/a.png"');
		expect(ok).toContain('alt="설명"');
		expect(ok).toContain("캡션");
		expect(ok).toContain("width:60%");

		const unresolved = await html('<Image src="javascript:alert(1)" alt="대체" caption="캡션" />', {
			labels: { imageUnavailable: "표시할 수 없음" },
		});
		expect(unresolved).not.toContain("<img");
		expect(unresolved).toContain("표시할 수 없음");
		expect(unresolved).not.toContain("대체");
		expect(unresolved).toContain("캡션");
	});

	it("accepts an image resolver and a link rewriter", async () => {
		const markup = await html(
			'<Image mediaId="m1" alt="a" />\n\n[안](/a) [밖](https://example.com) [나쁜](javascript:x)',
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

	it("<File> renders the name, type, size and a download link, and if unresolved only the name remains", async () => {
		const source = '<File mediaId="11111111-1111-4111-8111-111111111111" label="발표 자료" />';
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
				components: {
					blocks: { [block.name]: ({ source }: { source: string }) => <output data-source={source} /> },
				} as never,
			});
			expect(markup).toContain('data-source="A -&gt; B"');
		},
	);
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import { renderMdx } from "../index";

const html = async (source: string, options?: Parameters<typeof renderMdx>[1]) =>
	renderToStaticMarkup((await renderMdx(source, options)).content);

/** 설정에 있는 첫 코드 펜스 블록(차트·다이어그램 등). */
const fenceBlock = ADDED_BLOCKS.find((block) => block.syntax.kind === "fence");

/** 본문 그리기(M14-2). 블로그 공개 렌더 검사를 본체 기본 컴포넌트로 옮겼다(두 설정으로 돈다). */
describe("본문 그리기 @monti-cms/core/render", () => {
	it("마크다운·표·줄바꿈·목차를 그린다", async () => {
		const rendered = await renderMdx("## 제목\n\n첫 줄\n둘째 줄\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");
		const markup = renderToStaticMarkup(rendered.content);
		expect(markup).toContain('<h2 id="제목">');
		expect(markup).toContain("<br/>");
		expect(markup).toContain("<table");
		expect(rendered.toc).toEqual([expect.objectContaining({ value: "제목", depth: 0 })]);
	});

	it("검사에 걸리는 본문은 그리지 않는다", async () => {
		await expect(renderMdx("<Unclosed>")).rejects.toThrow(/MDX validation failed/);
	});

	it("인라인 지시자·줄바꿈 지시자를 요소로 그린다", async () => {
		const markup = await html("밑줄은 :u[밑줄] 위는 :sup[위] 아래는 :sub[아래] 첫 줄:br[]둘째 줄");
		expect(markup).toContain("<u>밑줄</u>");
		expect(markup).toContain("<sup>위</sup>");
		expect(markup).toContain("<sub>아래</sub>");
		expect(markup).toContain("<br/>");
	});

	it(":::text-align은 검증된 정렬만 클래스로 바꾼다", async () => {
		expect(await html(':::text-align{align="center"}\n가운데\n:::')).toContain('class="cms-align-center"');
		expect(await html(':::text-align{align="justify"}\n무시\n:::')).not.toContain("cms-align-justify");
	});

	it("::image는 주소·대체 글·캡션·너비를 그리고, 해석하지 못하면 빈 자리와 캡션만 남긴다", async () => {
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

	it("이미지 해석기·링크 바꾸기를 받는다", async () => {
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

	it("::file은 이름·형식·크기와 내려받기 링크를 그리고, 해석하지 못하면 이름만 남긴다", async () => {
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

	it("코드 펜스는 강조하고, 미등록 지시자는 본문 글자로 남긴다", async () => {
		const code = await html("```ts\nconst a = 1;\n```");
		expect(code).toContain('class="shiki');
		expect(await html("openai/gpt-oss-120b:free를 쓴다.")).toContain("gpt-oss-120b:free를");
	});

	it.skipIf(!fenceBlock)(
		"코드 펜스 블록은 블록 컴포넌트에 원문(source)으로 넘기고, 사이트가 컴포넌트를 덮어쓴다",
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

import { readFileSync } from "node:fs";
import path from "node:path";
import { mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { analyze } from "@monti-cms/core/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 블록은 플러그인(`blocks()`)으로 넣은 설정으로 돌려, 공개 컴포넌트가 플러그인 `render`에서 오게 한다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const source = readFileSync(path.join(__dirname, "fixtures/component-showcase.mdx"), "utf8");

/** 편집기와 공개 화면을 같은 글로 맞추는 검사. 공개 화면은 본체·블록 확장이 주는 기본 컴포넌트로 그린다. */
describe("CMS 컴포넌트 샘플 글", () => {
	it("검사를 통과하고, 편집기를 거쳐도 글자 그대로다", () => {
		expect(analyze(source).errors).toEqual([]);
		const editorDocument = mdxToTiptap(source);
		expect(editorDocument.content?.length).toBeGreaterThan(30);
		expect(tiptapToMdx(editorDocument).trim()).toBe(source.trim());
	});

	it("공개 화면이 모든 섹션을 라이브러리 기본 모양으로 그린다", async () => {
		const html = renderToStaticMarkup((await renderMdx(source)).content);

		for (const text of [
			"직접 지정한 팁 제목",
			"처음부터 열린 접기",
			"가운데 정렬 문단",
			"블로그 렌더링 흐름을 보여 주는 스크린샷",
			"자르기와 90도 회전을 적용한 이미지",
			"대체 텍스트가 없는 장식 이미지",
			"글자 단위 접기",
		]) {
			expect(html, text).toContain(text);
		}

		// 블록 확장의 기본 컴포넌트
		expect(html.match(/class="cms-block-callout"/g)).toHaveLength(5);
		expect(html.match(/<details class="cms-block-collapsible"/g)).toHaveLength(2);
		// 코드 줄 접기(`@line collapse`)는 본체 기본 컴포넌트다.
		expect(html).toContain("cms-code-collapse");
		expect(html).toContain('role="tablist"');
		expect(html.match(/role="tabpanel"/g)).toHaveLength(3);
		expect(html).toContain('class="cms-block-columns"');
		expect(html.match(/class="cms-block-column"/g)).toHaveLength(3);
		expect(html).toContain('class="cms-block-tooltip"');
		// 펜스 블록은 서버에서 원문을 보인다(그리기는 브라우저). 차트 4개, 다이어그램 1개이고 문법 오류가 없다.
		expect(html.match(/class="cms-block-chart"/g)).toHaveLength(4);
		expect(html.match(/class="cms-block-mermaid"/g)).toHaveLength(1);
		expect(html).not.toContain("cms-block-chart-error");

		// 본체 기본 컴포넌트
		expect(html).toContain("cms-align-center");
		expect(html.match(/<figure class="cms-image/g)).toHaveLength(3);
		expect(html).toContain("<u>밑줄</u>");
		expect(html).toContain("<sup>위 첨자</sup>");
		expect(html).toContain("<sub>아래 첨자</sub>");
		expect(html).toContain("<br/>둘째 줄");
		expect(html).toContain("katex-display");
		expect(html).toContain("<table");
		// 지시자 표: 머리글 칸과 가로·세로 병합이 살아 있다.
		expect(html).toMatch(/<th[^>]*colSpan="2"/);
		expect(html).toMatch(/<td[^>]*rowSpan="2"/);
		// 코드 블록: 강조된 코드와 접기
		expect(html.match(/<pre[^>]*class="shiki/g)?.length).toBeGreaterThanOrEqual(3);
		// 목록·인용·링크 같은 기본 마크다운
		expect(html).toContain("<blockquote>");
		expect(html).toContain('href="/posts"');
	});
});

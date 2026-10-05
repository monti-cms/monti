import { readFileSync } from "node:fs";
import path from "node:path";
import { mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { analyze } from "@monti-cms/core/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Run blocks with the config supplied by the plugin (`blocks()`), so public components come from the plugin `render`.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const source = readFileSync(path.join(__dirname, "fixtures/component-showcase.mdx"), "utf8");

/** Checks that the editor and the public page agree on the same content. The public page renders with the default components provided by the core and the block extensions. */
describe("CMS component showcase", () => {
	it("passes validation and stays identical after a round trip through the editor", () => {
		expect(analyze(source).errors).toEqual([]);
		const editorDocument = mdxToTiptap(source);
		expect(editorDocument.content?.length).toBeGreaterThan(30);
		expect(tiptapToMdx(editorDocument).trim()).toBe(source.trim());
	});

	it("the public page renders every section with the library default look", async () => {
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

		// Default components of the block extensions
		expect(html).toContain('class="cms-block-callout"');
		expect(html).toContain('<details class="cms-block-collapsible"');
		// Code line collapse (`@line collapse`) is a core default component.
		expect(html).toContain("cms-code-collapse");
		expect(html).toContain('role="tablist"');
		expect(html).toContain('role="tabpanel"');
		expect(html).toContain('class="cms-block-columns"');
		expect(html).toContain('class="cms-block-column"');
		expect(html).toContain('class="cms-block-tooltip"');
		// Fence blocks show the source on the server (drawing happens in the browser). No syntax errors.
		expect(html).toContain('class="cms-block-chart"');
		expect(html).toContain('class="cms-block-mermaid"');
		expect(html).not.toContain("cms-block-chart-error");

		// Core default components
		expect(html).toContain("cms-align-center");
		expect(html).toContain('<figure class="cms-image');
		expect(html).toContain("<u>밑줄</u>");
		expect(html).toContain("<sup>위 첨자</sup>");
		expect(html).toContain("<sub>아래 첨자</sub>");
		expect(html).toContain("<br/>둘째 줄");
		expect(html).toContain("katex-display");
		expect(html).toContain("<table");
		// Directive table: header cells and horizontal/vertical merges are preserved.
		expect(html).toMatch(/<th[^>]*colSpan="2"/);
		expect(html).toMatch(/<td[^>]*rowSpan="2"/);
		// Code block: highlighted code and collapsing
		expect(html.match(/<pre[^>]*class="shiki/g)?.length).toBeGreaterThanOrEqual(3);
		// Basic Markdown such as lists, quotes, and links
		expect(html).toContain("<blockquote>");
		expect(html).toContain('href="/posts"');
	});
});

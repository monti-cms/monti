import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The core example config adds blocks as definitions only. Public components come from the plugin, so this test swaps in a config that uses `blocks()`.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const html = async (source: string, locale?: string) =>
	renderToStaticMarkup((await renderMdx(source, { locale })).content);

describe("block extension public components", () => {
	it("callout renders variant, title and body, and uses the variant name when there is no title", async () => {
		const markup = await html(':::callout{variant="warning" title="주의"}\n본문 **굵게**\n:::');
		expect(markup).toContain('class="cms-block-callout"');
		expect(markup).toContain('data-variant="warning"');
		expect(markup).toContain('<div class="cms-block-callout-title">주의</div>');
		expect(markup).toContain("<strong>굵게</strong>");

		const fallback = await html(':::callout{variant="tip"}\n내용\n:::', "ko");
		expect(fallback).toContain('<div class="cms-block-callout-title">팁</div>');
		expect(await html(":::callout\n내용\n:::", "en")).toContain(">Note</div>");
		// An unknown variant falls back to note, and a callout with no body has no body slot.
		const unknown = await html(':::callout{variant="nope" title="제목만"}\n:::');
		expect(unknown).toContain('data-variant="note"');
		expect(unknown).not.toContain("cms-block-callout-body");
	});

	it("collapsible renders as details and follows title, initially open and default title", async () => {
		const markup = await html(':::collapsible{title="더 보기" defaultOpen}\n숨은 내용\n:::');
		expect(markup).toContain("<details");
		expect(markup).toContain(" open");
		expect(markup).toContain('<summary class="cms-block-collapsible-summary">더 보기</summary>');
		expect(markup).toContain("숨은 내용");

		const closed = await html(":::collapsible\n내용\n:::", "ko");
		expect(closed).not.toContain(" open");
		expect(closed).toContain(">펼치기</summary>");
		expect(await html(":::collapsible\n내용\n:::", "en")).toContain(">Show more</summary>");
	});

	it("tabs render the tab label row and each tab body with roles", async () => {
		const markup = await html(
			'::::tabs{defaultValue="둘째"}\n:::tab{label="첫째"}\n첫 내용\n:::\n:::tab{label="둘째"}\n둘째 내용\n:::\n::::',
		);
		expect(markup).toContain('role="tablist"');
		expect(markup.match(/role="tab"/g)).toHaveLength(2);
		expect(markup.match(/role="tabpanel"/g)).toHaveLength(2);
		expect(markup).toContain(">첫째</button>");
		expect(markup).toContain(">둘째</button>");
		// The initially open tab is the second, so only the first body is hidden.
		expect(markup).toMatch(/aria-selected="false"[^>]*>첫째/);
		expect(markup).toMatch(/aria-selected="true"[^>]*>둘째/);
		expect(markup).toMatch(/hidden=""[^>]*><p>첫 내용<\/p>/);
		expect(markup).toMatch(/role="tabpanel"[^>]*><p>둘째 내용<\/p>/);
		// Only the selected tab is reachable with the Tab key.
		expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
	});

	it("the initially open tab falls back to the first tab when missing or invalid", async () => {
		const markup = await html(
			':::::tabs{defaultValue="없음"}\n::::tab{label="A"}\na\n::::\n::::tab{label="B"}\nb\n::::\n:::::',
		);
		expect(markup).toMatch(/aria-selected="true"[^>]*>A/);
	});

	it("columns convert column widths into grid columns", async () => {
		const markup = await html('::::columns{widths="60,40"}\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::');
		expect(markup).toContain('class="cms-block-columns"');
		expect(markup).toContain("--cms-columns:minmax(0, 60fr) minmax(0, 40fr)");
		expect(markup.match(/class="cms-block-column"/g)).toHaveLength(2);

		// Widths that do not match the column count are split evenly.
		const equal = await html('::::columns{widths="70,20,10"}\n:::column\na\n:::\n:::column\nb\n:::\n::::');
		expect(equal).toContain("--cms-columns:repeat(2, minmax(0, 1fr))");
	});

	it("text color accepts only hex values", async () => {
		const markup = await html(':color[빨강]{fg="#DC2626" fgDark="#f87171" bg="#fee2e2"}');
		expect(markup).toContain('class="cms-color"');
		expect(markup).toContain("data-fg");
		expect(markup).toContain("data-bg");
		expect(markup).toContain("--cms-fg:#dc2626");
		expect(markup).toContain("--cms-fg-dark:#f87171");
		expect(markup).toContain("빨강");

		const bad = await html(':color[나쁨]{fg="red;background:url(x)" bg="expression(1)"}');
		expect(bad).not.toContain("data-fg");
		expect(bad).not.toContain("--cms-fg");
		expect(bad).not.toContain("url(");
		expect(bad).toContain("나쁨");
	});

	it("tooltip renders the text and description as keyboard-reachable elements", async () => {
		const markup = await html(':tooltip[용어]{content="뜻풀이"}');
		expect(markup).toContain('class="cms-block-tooltip"');
		expect(markup).toMatch(
			/<span class="cms-block-tooltip-trigger" tabindex="0" aria-describedby="([^"]+)">용어<\/span>/,
		);
		const id = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
		expect(markup).toContain(`<span id="${id}" role="tooltip" class="cms-block-tooltip-content">뜻풀이</span>`);
	});

	it("code ref renders as labeled, pressable text", async () => {
		const markup = await html(':code-ref[이 줄]{to="c1"}');
		expect(markup).toContain('data-code-ref="c1"');
		expect(markup).toContain('role="button"');
		expect(markup).toContain('tabindex="0"');
		expect(markup).toContain("이 줄");
	});

	it("Mermaid shows the source on the server (the diagram is drawn in the browser)", async () => {
		const markup = await html("```mermaid\ngraph TD\n  A --> B\n```");
		expect(markup).toContain('class="cms-block-mermaid"');
		expect(markup).toContain('data-state="loading"');
		expect(markup).toContain('<pre class="cms-block-mermaid-source"><code>graph TD\n  A --&gt; B</code></pre>');
	});

	it("chart shows the source on the server and reports an error per line when the syntax is wrong", async () => {
		const source = [
			"chart bar",
			"x month",
			"series views | 조회수 | chart-1",
			"",
			"data",
			"month | views",
			"Jan | 1200",
		].join("\n");
		const ok = await html(`\`\`\`chart\n${source}\n\`\`\``);
		expect(ok).toContain('class="cms-block-chart"');
		expect(ok).toContain('data-state="loading"');
		expect(ok).toContain("Jan | 1200");
		expect(ok).not.toContain("cms-block-chart-error");

		const broken = await html("```chart\nchart nope\n```", "en");
		expect(broken).toContain('class="cms-block-chart-error"');
		expect(broken).toContain('role="alert"');
		expect(broken).toContain("Chart syntax error");
		expect(broken).toMatch(/<li>Line \d+: /);
		// The error text is built in the content language from the parser's code and values (not the admin language).
		expect(broken).toContain("Unsupported chart type: nope");
		const korean = await html("```chart\nchart nope\n```", "ko");
		expect(korean).toContain("차트 문법 오류");
		expect(korean).toContain("지원하지 않는 차트 타입입니다: nope");
		expect(await html("```chart\nchart nope\n```", "ja")).toContain("サポートされていないグラフの種類です: nope");
	});

	it("a component the site passes under the same name wins", async () => {
		const { content } = await renderMdx(":::callout\n내용\n:::", {
			components: { Callout: ({ children }: { children?: React.ReactNode }) => <aside id="mine">{children}</aside> },
		});
		const markup = renderToStaticMarkup(content);
		expect(markup).toContain('<aside id="mine">');
		expect(markup).not.toContain("cms-block-callout");
	});
});

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
		const markup = await html('<Callout variant="warning" title="주의">\n\n본문 **굵게**\n\n</Callout>');
		expect(markup).toContain('class="cms-block-callout"');
		expect(markup).toContain('data-variant="warning"');
		expect(markup).toContain('<div class="cms-block-callout-title">주의</div>');
		expect(markup).toContain("<strong>굵게</strong>");

		const fallback = await html('<Callout variant="tip">\n\n내용\n\n</Callout>', "ko");
		expect(fallback).toContain('<div class="cms-block-callout-title">팁</div>');
		expect(await html("<Callout>\n\n내용\n\n</Callout>", "en")).toContain(">Note</div>");
		// An unknown variant falls back to note, and a callout with no body has no body slot.
		const unknown = await html('<Callout variant="nope" title="제목만" />');
		expect(unknown).toContain('data-variant="note"');
		expect(unknown).not.toContain("cms-block-callout-body");
	});

	it("collapsible renders as details and follows title, initially open and default title", async () => {
		const markup = await html('<Collapsible title="더 보기" defaultOpen>\n\n숨은 내용\n\n</Collapsible>');
		expect(markup).toContain("<details");
		expect(markup).toContain(" open");
		expect(markup).toContain('<summary class="cms-block-collapsible-summary">더 보기</summary>');
		expect(markup).toContain("숨은 내용");

		const closed = await html("<Collapsible>\n\n내용\n\n</Collapsible>", "ko");
		expect(closed).not.toContain(" open");
		expect(closed).toContain(">펼치기</summary>");
		expect(await html("<Collapsible>\n\n내용\n\n</Collapsible>", "en")).toContain(">Show more</summary>");
	});

	it("tabs render the tab label row and each tab body with roles", async () => {
		const markup = await html(
			'<Tabs defaultValue="둘째">\n\n<Tab label="첫째">\n\n첫 내용\n\n</Tab>\n\n<Tab label="둘째">\n\n둘째 내용\n\n</Tab>\n\n</Tabs>',
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
			'<Tabs defaultValue="없음">\n\n<Tab label="A">\n\na\n\n</Tab>\n\n<Tab label="B">\n\nb\n\n</Tab>\n\n</Tabs>',
		);
		expect(markup).toMatch(/aria-selected="true"[^>]*>A/);
	});

	it("columns convert column widths into grid columns", async () => {
		const markup = await html(
			'<Columns widths="60,40">\n\n<Column>\n\n왼쪽\n\n</Column>\n\n<Column>\n\n오른쪽\n\n</Column>\n\n</Columns>',
		);
		expect(markup).toContain('class="cms-block-columns"');
		expect(markup).toContain("--cms-columns:minmax(0, 60fr) minmax(0, 40fr)");
		expect(markup.match(/class="cms-block-column"/g)).toHaveLength(2);

		// Widths that do not match the column count are split evenly.
		const equal = await html(
			'<Columns widths="70,20,10">\n\n<Column>\n\na\n\n</Column>\n\n<Column>\n\nb\n\n</Column>\n\n</Columns>',
		);
		expect(equal).toContain("--cms-columns:repeat(2, minmax(0, 1fr))");
	});

	it("text color accepts only hex values", async () => {
		const markup = await html('<Color fg="#DC2626" fgDark="#f87171" bg="#fee2e2">빨강</Color>');
		expect(markup).toContain('class="cms-color"');
		expect(markup).toContain("data-fg");
		expect(markup).toContain("data-bg");
		expect(markup).toContain("--cms-fg:#dc2626");
		expect(markup).toContain("--cms-fg-dark:#f87171");
		expect(markup).toContain("빨강");

		const bad = await html('<Color fg="red;background:url(x)" bg="expression(1)">나쁨</Color>');
		expect(bad).not.toContain("data-fg");
		expect(bad).not.toContain("--cms-fg");
		expect(bad).not.toContain("url(");
		expect(bad).toContain("나쁨");
	});

	it("tooltip renders the text and description as keyboard-reachable elements", async () => {
		const markup = await html('<Tooltip content="뜻풀이">용어</Tooltip>');
		expect(markup).toContain('class="cms-block-tooltip"');
		expect(markup).toContain("용어");
		const id = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
		expect(id).toBeTruthy();
		expect(markup).toMatch(new RegExp(`<[^>]*id="${id}"[^>]*role="tooltip"[^>]*>뜻풀이<`));
		expect(markup).toMatch(/tabindex="0"[^>]*aria-describedby=/);
	});

	it("code ref renders as labeled, pressable text", async () => {
		const markup = await html('<CodeRef to="c1">이 줄</CodeRef>');
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
		// One entry per error, naming the line (the source's first line) and the offending value.
		expect(broken).toMatch(/<li>[^<]*\b1\b[^<]*<\/li>/);
		expect(broken).toContain("nope");
		// The error text is built in the content language (not the admin language), so each locale words it differently.
		const korean = await html("```chart\nchart nope\n```", "ko");
		const japanese = await html("```chart\nchart nope\n```", "ja");
		expect(korean).toContain("nope");
		expect(japanese).toContain("nope");
		expect(korean).not.toBe(broken);
		expect(japanese).not.toBe(broken);
		expect(japanese).not.toBe(korean);
	});

	it("a component the site passes under the same name wins", async () => {
		const { content } = await renderMdx("<Callout>\n\n내용\n\n</Callout>", {
			components: { Callout: ({ children }: { children?: React.ReactNode }) => <aside id="mine">{children}</aside> },
		});
		const markup = renderToStaticMarkup(content);
		expect(markup).toContain('<aside id="mine">');
		expect(markup).not.toContain("cms-block-callout");
	});
});

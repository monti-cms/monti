import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 본체 예시 설정은 블록을 정의로만 넣는다. 공개 컴포넌트는 플러그인에서 오므로 이 테스트는 `blocks()`를 쓰는 설정으로 바꾼다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const html = async (source: string, locale?: string) =>
	renderToStaticMarkup((await renderMdx(source, { locale })).content);

describe("블록 확장 공개 컴포넌트", () => {
	it("콜아웃은 종류·제목·본문을 그리고, 제목이 없으면 종류 이름을 쓴다", async () => {
		const markup = await html(':::callout{variant="warning" title="주의"}\n본문 **굵게**\n:::');
		expect(markup).toContain('class="cms-block-callout"');
		expect(markup).toContain('data-variant="warning"');
		expect(markup).toContain('<div class="cms-block-callout-title">주의</div>');
		expect(markup).toContain("<strong>굵게</strong>");

		const fallback = await html(':::callout{variant="tip"}\n내용\n:::', "ko");
		expect(fallback).toContain('<div class="cms-block-callout-title">팁</div>');
		expect(await html(":::callout\n내용\n:::", "en")).toContain(">Note</div>");
		// 모르는 종류는 노트, 본문 없는 콜아웃은 본문 칸이 없다.
		const unknown = await html(':::callout{variant="nope" title="제목만"}\n:::');
		expect(unknown).toContain('data-variant="note"');
		expect(unknown).not.toContain("cms-block-callout-body");
	});

	it("접기는 details로 그리고 제목·처음 열림·기본 제목을 따른다", async () => {
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

	it("탭은 탭 이름 줄과 탭마다의 본문을 역할과 함께 그린다", async () => {
		const markup = await html(
			'::::tabs{defaultValue="둘째"}\n:::tab{label="첫째"}\n첫 내용\n:::\n:::tab{label="둘째"}\n둘째 내용\n:::\n::::',
		);
		expect(markup).toContain('role="tablist"');
		expect(markup.match(/role="tab"/g)).toHaveLength(2);
		expect(markup.match(/role="tabpanel"/g)).toHaveLength(2);
		expect(markup).toContain(">첫째</button>");
		expect(markup).toContain(">둘째</button>");
		// 처음 열 탭은 둘째라서 첫째 본문만 숨는다.
		expect(markup).toMatch(/aria-selected="false"[^>]*>첫째/);
		expect(markup).toMatch(/aria-selected="true"[^>]*>둘째/);
		expect(markup).toMatch(/hidden=""[^>]*><p>첫 내용<\/p>/);
		expect(markup).toMatch(/role="tabpanel"[^>]*><p>둘째 내용<\/p>/);
		// 선택된 탭만 Tab 키로 닿는다.
		expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
	});

	it("탭의 처음 열 탭이 없거나 맞지 않으면 첫 탭이다", async () => {
		const markup = await html(
			':::::tabs{defaultValue="없음"}\n::::tab{label="A"}\na\n::::\n::::tab{label="B"}\nb\n::::\n:::::',
		);
		expect(markup).toMatch(/aria-selected="true"[^>]*>A/);
	});

	it("단 나누기는 단 너비를 격자 열로 바꾼다", async () => {
		const markup = await html('::::columns{widths="60,40"}\n:::column\n왼쪽\n:::\n:::column\n오른쪽\n:::\n::::');
		expect(markup).toContain('class="cms-block-columns"');
		expect(markup).toContain("--cms-columns:minmax(0, 60fr) minmax(0, 40fr)");
		expect(markup.match(/class="cms-block-column"/g)).toHaveLength(2);

		// 단 수와 맞지 않는 너비는 똑같이 나눈다.
		const equal = await html('::::columns{widths="70,20,10"}\n:::column\na\n:::\n:::column\nb\n:::\n::::');
		expect(equal).toContain("--cms-columns:repeat(2, minmax(0, 1fr))");
	});

	it("글자색은 헥스 값만 받는다", async () => {
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

	it("툴팁은 글자와 설명을 키보드로 닿는 요소로 그린다", async () => {
		const markup = await html(':tooltip[용어]{content="뜻풀이"}');
		expect(markup).toContain('class="cms-block-tooltip"');
		expect(markup).toMatch(
			/<span class="cms-block-tooltip-trigger" tabindex="0" aria-describedby="([^"]+)">용어<\/span>/,
		);
		const id = /aria-describedby="([^"]+)"/.exec(markup)?.[1];
		expect(markup).toContain(`<span id="${id}" role="tooltip" class="cms-block-tooltip-content">뜻풀이</span>`);
	});

	it("코드 연결은 이름표를 단 눌러 볼 수 있는 글자로 그린다", async () => {
		const markup = await html(':code-ref[이 줄]{to="c1"}');
		expect(markup).toContain('data-code-ref="c1"');
		expect(markup).toContain('role="button"');
		expect(markup).toContain('tabindex="0"');
		expect(markup).toContain("이 줄");
	});

	it("Mermaid는 서버에서 원문을 보인다(다이어그램은 브라우저에서 그린다)", async () => {
		const markup = await html("```mermaid\ngraph TD\n  A --> B\n```");
		expect(markup).toContain('class="cms-block-mermaid"');
		expect(markup).toContain('data-state="loading"');
		expect(markup).toContain('<pre class="cms-block-mermaid-source"><code>graph TD\n  A --&gt; B</code></pre>');
	});

	it("차트는 서버에서 원문을 보이고, 문법이 틀리면 줄마다 오류를 알린다", async () => {
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
		// 오류 글은 파서가 준 코드와 값에서 글 언어로 만든다(관리자 언어가 아니다).
		expect(broken).toContain("Unsupported chart type: nope");
		const korean = await html("```chart\nchart nope\n```", "ko");
		expect(korean).toContain("차트 문법 오류");
		expect(korean).toContain("지원하지 않는 차트 타입입니다: nope");
		expect(await html("```chart\nchart nope\n```", "ja")).toContain("サポートされていないグラフの種類です: nope");
	});

	it("사이트가 같은 이름의 컴포넌트를 넘기면 그것이 이긴다", async () => {
		const { content } = await renderMdx(":::callout\n내용\n:::", {
			components: { Callout: ({ children }: { children?: React.ReactNode }) => <aside id="mine">{children}</aside> },
		});
		const markup = renderToStaticMarkup(content);
		expect(markup).toContain('<aside id="mine">');
		expect(markup).not.toContain("cms-block-callout");
	});
});

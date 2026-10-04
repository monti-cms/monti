import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 블록은 플러그인(`blocks()`)으로 넣은 설정으로 돌려, 공개 컴포넌트가 플러그인 `render`에서 오게 한다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const html = async (source: string) => renderToStaticMarkup((await renderMdx(source)).content);

describe("글자색 공개 화면", () => {
	// 저장 형식: `:color[글]{fg fgDark bg bgDark}`(헥스 값, 밝은·어두운 테마 짝).
	const SOURCE =
		'빨간 :color[경고]{fg="#dc2626" fgDark="#f87171"}와 :color[**강조**]{bg="#fef3c7" bgDark="#453a12"} 글.';

	it("테마별 CSS 변수를 붙이고, 헥스가 아닌 값은 버린다", async () => {
		const markup = await html(`${SOURCE}\n\n:color[위험]{fg="red; background:url(x)"}`);
		expect(markup).toContain('class="cms-color" style="--cms-fg:#dc2626;--cms-fg-dark:#f87171" data-fg=""');
		expect(markup).toMatch(
			/<span class="cms-color" style="--cms-bg:#fef3c7;--cms-bg-dark:#453a12" data-bg=""><strong>강조<\/strong><\/span>/,
		);
		expect(markup).toContain('<span class="cms-color">위험</span>');
		expect(markup).not.toContain("url(x)");
	});
});

describe("본문–코드 잇기 공개 화면", () => {
	// 저장 형식: 본문 `:code-ref[글자]{to}` ↔ 코드 줄 이름표 `// @line anchor {..} id`.
	const SOURCE = [
		'이 :code-ref[함수가]{to="c1"} 값을 돌려준다.',
		"",
		"```ts",
		'// @line anchor {1-2} id="c1"',
		"function add(a, b) {",
		"  const sum = a + b;",
		"  return sum;",
		"}",
		"```",
	].join("\n");

	it("연결 글자와 이름표 달린 코드 줄을 낸다", async () => {
		const markup = await html(SOURCE);
		expect(markup).toMatch(/data-code-ref="c1"[^>]*>함수가/);
		// 이름표가 붙은 두 줄에 `data-anchor`가 달린다(코드 연결이 브라우저에서 이 줄을 강조한다).
		expect(markup.match(/<span class="line code-anchor" data-anchor="c1"/g)).toHaveLength(2);
	});
});

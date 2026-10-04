import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Run blocks with the config supplied by the plugin (`blocks()`), so public components come from the plugin `render`.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const html = async (source: string) => renderToStaticMarkup((await renderMdx(source)).content);

describe("text color public page", () => {
	// Stored format: `:color[text]{fg fgDark bg bgDark}` (hex values, light/dark theme pair).
	const SOURCE =
		'빨간 :color[경고]{fg="#dc2626" fgDark="#f87171"}와 :color[**강조**]{bg="#fef3c7" bgDark="#453a12"} 글.';

	it("attaches per-theme CSS variables and drops non-hex values", async () => {
		const markup = await html(`${SOURCE}\n\n:color[위험]{fg="red; background:url(x)"}`);
		expect(markup).toContain('class="cms-color" style="--cms-fg:#dc2626;--cms-fg-dark:#f87171" data-fg=""');
		expect(markup).toMatch(
			/<span class="cms-color" style="--cms-bg:#fef3c7;--cms-bg-dark:#453a12" data-bg=""><strong>강조<\/strong><\/span>/,
		);
		expect(markup).toContain('<span class="cms-color">위험</span>');
		expect(markup).not.toContain("url(x)");
	});
});

describe("body-to-code link public page", () => {
	// Stored format: body `:code-ref[text]{to}` <-> code line label `// @line anchor {..} id`.
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

	it("renders the linked text and the labeled code lines", async () => {
		const markup = await html(SOURCE);
		expect(markup).toMatch(/data-code-ref="c1"[^>]*>함수가/);
		// The two labeled lines get `data-anchor` (the code link highlights these lines in the browser).
		expect(markup.match(/<span class="line code-anchor" data-anchor="c1"/g)).toHaveLength(2);
	});
});

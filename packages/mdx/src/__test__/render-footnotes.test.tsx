import { describe, expect, it } from "vitest";
import type { RenderMdxOptions } from "../render";
import { analyze, renderFixture, serialize, toDocument } from "../testing";

const render = async (source: string, options?: RenderMdxOptions) => {
	const rendered = await renderFixture(source, options);
	return { markup: rendered.html, toc: rendered.toc };
};

const SOURCE = [
	"## Intro",
	"",
	"First claim[^1] and a second one[^note].",
	"",
	"[^1]: The first source.",
	"",
	"[^note]: A longer note with a [link](/docs/a) and `code`.",
	"",
	"    ```ts",
	"    const a = 1;",
	"    ```",
	"",
].join("\n");

describe("footnote rendering", () => {
	it("renders references and the footnote section", async () => {
		const { markup } = await render(SOURCE);
		expect(markup).toContain('<section data-footnotes="true" class="footnotes">');
		expect(markup).toContain('href="#user-content-fn-1"');
		expect(markup).toContain('id="user-content-fnref-1"');
		expect(markup).toContain('data-footnote-ref="true"');
		expect(markup).toContain('id="user-content-fn-1"');
		expect(markup).toContain("The first source.");
		expect(markup).toContain('id="user-content-fn-note"');
		expect(markup).toContain('href="#user-content-fn-note"');
	});

	it("keeps the back references to the reference position", async () => {
		const { markup } = await render(SOURCE);
		expect(markup).toContain('href="#user-content-fnref-1"');
		expect(markup).toContain("data-footnote-backref");
	});

	it("keeps rich content inside a definition", async () => {
		const { markup } = await render(SOURCE);
		expect(markup).toContain('href="/docs/a"');
		expect(markup).toContain("<code>code</code>");
		expect(markup).toContain("const");
	});

	it("adds no heading anchor or table of contents entry for the footnote heading", async () => {
		const { markup, toc } = await render(SOURCE);
		expect(markup).toContain('<h2 id="intro"><a href="#intro"');
		expect(markup).toContain('<h2 class="sr-only" id="footnote-label">Footnotes</h2>');
		expect(toc.map((item) => item.value)).toEqual(["Intro"]);
	});

	it("renders the same footnotes after a document round trip", async () => {
		const stored = serialize(toDocument(analyze(SOURCE)));
		expect((await render(stored)).markup).toBe((await render(SOURCE)).markup);
	});

	it("keeps footnote links working when in-site links are rewritten", async () => {
		const { markup } = await render(SOURCE, { resolveHref: (href) => (href.startsWith("/") ? `/en${href}` : href) });
		expect(markup).toContain('href="#user-content-fn-1"');
		expect(markup).toContain('href="/en/docs/a"');
	});
});

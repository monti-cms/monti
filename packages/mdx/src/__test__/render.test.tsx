import { definePlugin } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { renderDocument } from "@monti-cms/core/render";
import type { Root } from "mdast";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../core/test/site";
import { mdxFormat } from "../format";
import { type RenderMdxOptions, renderMdx as renderMdxOf } from "../render";
import type { SyntaxExtension } from "../syntax";
import { siteCodeLineEffects, siteSyntaxBlocks } from "../syntax-config";
import { renderFixture as renderFixtureOf } from "../testing";

// A plugin of the site config gives the public component of a block (`render` of `definePlugin`), the way a block extension does.
const fake = definePlugin({
	name: "fake-callout-render",
	options: {},
	render: async () => ({
		documentComponents: () => ({
			blocks: {
				callout: ({ title, children }: { title?: string; children?: ReactNode }) => (
					<aside data-from-plugin="yes">
						<strong>{title}</strong>
						{children}
					</aside>
				),
			},
		}),
	}),
});
const site = createSite({ ...testConfig, plugins: [...(testConfig.plugins ?? []), fake] });

const renderMdx = (source: string, options: Partial<RenderMdxOptions> = {}) =>
	renderMdxOf(source, { site, ...options });
const renderFixture = (source: string, options: Partial<RenderMdxOptions> = {}) =>
	renderFixtureOf(source, { site, ...options });

/** A made-up notation: `@@word@@` is an underlined word. */
const atNotation: SyntaxExtension = {
	name: "at",
	remarkPlugins: [
		() => (tree: Root) => {
			visit(tree, "text", (node, index, parent) => {
				const match = /@@(\w+)@@/.exec(node.value);
				if (!match || index == null || !parent) return;
				parent.children.splice(index, 1, {
					type: "mdxJsxTextElement",
					name: "u",
					attributes: [],
					children: [{ type: "text", value: match[1] ?? "" }],
				} as never);
			});
		},
	],
};

describe("renderMdx", () => {
	it("gives every heading a slug and collects them as the table of contents, in document order", async () => {
		const { html, toc } = await renderFixture("## Getting started\n\ntext\n\n## 시작하기\n\n### Deep dive\n");
		expect(toc.length).toBe(3);
		for (const item of toc) {
			expect(item.id).toBeTruthy();
			expect(item.href).toBe(`#${item.id}`);
			expect(html).toContain(`id="${item.id}"`);
		}
		expect(toc.map((item) => item.value)).toEqual(["Getting started", "시작하기", "Deep dive"]);
		// The third heading is one level below the first two.
		expect((toc[2]?.level ?? 0) - (toc[0]?.level ?? 0)).toBe(1);
		// Two headings never share an anchor.
		expect(new Set(toc.map((item) => item.id)).size).toBe(toc.length);
	});

	it("draws a footnote reference and its definition", async () => {
		const { html, unknown } = await renderFixture("A claim[^1].\n\n[^1]: The proof of it.\n");
		expect(unknown).toEqual([]);
		expect(html).toContain("The proof of it.");
		expect(html).toContain("A claim");
	});

	it("highlights a code block", async () => {
		const plain = await renderFixture("```ts\nconst answer = 42;\n```\n");
		expect(plain.html).toContain("answer");
		// Highlighted code is split into styled tokens, plain text is not.
		expect(plain.html).toMatch(/<span[^>]*style=/);
		expect(plain.html).not.toContain("const answer = 42;</code>");
	});

	it("draws math", async () => {
		const { html, unknown } = await renderFixture("The area is $E = mc^2$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n");
		expect(unknown).toEqual([]);
		expect(html).toContain("katex");
	});

	it("uses the public component a plugin of the site config gives a block", async () => {
		const { html, unknown } = await renderFixture('<Callout variant="tip" title="Heads up">Body words</Callout>\n');
		expect(unknown).toEqual([]);
		expect(html).toContain('data-from-plugin="yes"');
		expect(html).toContain("Heads up");
		expect(html).toContain("Body words");
	});

	it("lets the call override the component of a block", async () => {
		const { html } = await renderFixture('<Callout variant="tip" title="Heads up">Body words</Callout>\n', {
			components: {
				blocks: { callout: ({ title }: { title?: string }) => <section data-from-call="yes">{title}</section> },
			} as never,
		});
		expect(html).toContain('data-from-call="yes"');
		expect(html).not.toContain("data-from-plugin");
	});

	it("throws for a text that cannot be read, naming the reason", async () => {
		await expect(renderMdx("Words\n\n<Unclosed")).rejects.toThrow("MDX validation failed");
		await expect(renderMdx("import a from 'a'\n\ntext")).rejects.toThrow("MDX validation failed");
	});

	it("reads the syntax extensions it is given, and standard MDX without them", async () => {
		const withExtension = await renderFixture("앞 @@word@@ 뒤", { syntax: [atNotation] });
		expect(withExtension.html).toContain("<u>word</u>");
		const without = await renderFixture("앞 @@word@@ 뒤");
		expect(without.html).toContain("@@word@@");
	});

	it("draws a registered image from the refs of a read, and leaves out one the refs do not have", async () => {
		const known = "00000000-0000-4000-8000-0000000000a1";
		const unknownId = "00000000-0000-4000-8000-0000000000a2";
		const source = `<Image mediaId="${known}" alt="a photo" />\n\n<Image mediaId="${unknownId}" alt="gone" />\n`;
		const rendered = await renderMdx(source, {
			refs: { media: { [known]: { url: "https://cdn.test/photo.png", width: 64, height: 48 } }, links: {} },
		});
		const html = renderToStaticMarkup(rendered.content as ReactNode);
		expect(html).toContain("https://cdn.test/photo.png");
		expect(html).not.toContain(unknownId);

		// Without refs the registered image has no address to draw.
		const bare = renderToStaticMarkup((await renderMdx(source)).content as ReactNode);
		expect(bare).not.toContain("cdn.test");
	});

	it("draws what the document renderer draws for the same text", async () => {
		const source = "# Title\n\nSome *words* and a [link](https://example.com).\n";
		const read = await mdxFormat.import?.(source, {
			locale: "ko",
			blocks: siteSyntaxBlocks(site),
			codeLineEffects: siteCodeLineEffects(site),
			site,
		});
		if (!read?.ok) throw new Error("not read");
		const direct = renderToStaticMarkup((await renderDocument(read.doc, { site })).content as ReactNode);
		expect((await renderFixture(source)).html).toBe(direct);
	});
});

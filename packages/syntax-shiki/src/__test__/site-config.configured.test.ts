import { analyze, bodyFromMdx } from "@monti-cms/core/mdx";
import { mdxRemarkPlugins, renderMdx } from "@monti-cms/core/render";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * Runs with the extension switched on in the site config (`mdx.syntax`, see `vitest.configured.config.ts`), and with a `focus` line effect
 * in `codeBlock.lineEffects`: the extension reaches the parser and the public render chain without any explicit list.
 */
const SHIKI = "```ts\nconst a = 1\nconst b = 2 // [!code focus]\nconst c = 3 // [!code ++]\n```\n";

describe("Shiki notation configured in the site config", () => {
	it("is read by the parser and stored as Monti annotations, focus as the site's focus effect", () => {
		expect(analyze(SHIKI).errors).toEqual([]);
		const body = bodyFromMdx(SHIKI);
		expect(body.mdx).toBe("```ts\nconst a = 1\n// @line focus\nconst b = 2\n// @line plus\nconst c = 3\n```\n");
		expect(body.mdx).not.toContain("[!code");
	});

	it("is read by the public render chain, so unsaved Shiki notation renders", async () => {
		const markup = renderToStaticMarkup((await renderMdx(SHIKI)).content);
		expect(markup).not.toContain("[!code");
		expect(markup).toContain("line-focus");
		expect(markup).toContain("bg-green-400/10");
	});

	it("puts the extension's plugins in the public remark chain, before the code annotations are read", () => {
		expect(mdxRemarkPlugins().length).toBeGreaterThan(mdxRemarkPlugins([], []).length);
	});
});

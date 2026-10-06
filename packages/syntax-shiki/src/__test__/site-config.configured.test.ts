import { analyze, bodyFromMdx, configuredSyntax } from "@monti-cms/mdx/format";
import { renderMdx } from "@monti-cms/mdx/render";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * Runs with the extension switched on in the site config (`plugins: [mdx({ syntax })]`, see `vitest.configured.config.ts`), and with a `focus` line effect
 * in `codeBlock.lineEffects`: the extension reaches the parser and the public render through the plugin options, without any explicit list in the call.
 */
const SHIKI = "```ts\nconst a = 1\nconst b = 2 // [!code focus]\nconst c = 3 // [!code ++]\n```\n";

const syntax = configuredSyntax();

describe("Shiki notation configured in the site config", () => {
	it("is listed in the plugin options of the site config", () => {
		expect(syntax.length).toBeGreaterThan(0);
	});

	it("is read by the parser and stored as Monti annotations, focus as the site's focus effect", () => {
		expect(analyze(SHIKI, undefined, syntax).errors).toEqual([]);
		const body = bodyFromMdx(SHIKI, syntax);
		expect(body.mdx).toBe(
			"```ts\nconst a = 1\n// @line focus {1-1}\nconst b = 2\n// @line plus {2-2}\nconst c = 3\n```\n",
		);
		expect(body.mdx).not.toContain("[!code");
	});

	it("is read by the public render, so unsaved Shiki notation renders", async () => {
		const markup = renderToStaticMarkup((await renderMdx(SHIKI)).content);
		expect(markup).not.toContain("[!code");
		expect(markup).toContain("line-focus");
		expect(markup).toContain("bg-green-400/10");
	});
});

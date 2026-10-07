import { aiPlugin } from "@monti-cms/ai";
import { bareun } from "@monti-cms/bareun";
import { blocks } from "@monti-cms/blocks";
import { defineConfig } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import { seo } from "@monti-cms/seo";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import schema from "./monti.schema.json";

/**
 * A personal tech blog, modelled on the maintainer's own blog: posts, memos, categories, tags and series (the `collection` collection), in Korean (the default) and English.
 * Everything the blog uses is attached: all body blocks, the SEO fields, the AI plugin, the Bareun spell checker, and MDX written in the directive notation (`:::callout{…}`).
 *
 * The data of the site is in `monti.schema.json`: the collections and their fields and layouts (the SEO fields included), the locales, the time zone, the site and admin
 * settings, and the seed templates. Edit it there (editors autocomplete it through its `$schema`). `monti schema:types` writes `monti-env.d.ts` from it, so `cms.read`
 * and the admin know the collections without any type written by hand; `next dev` keeps that file up to date.
 * This file keeps what needs code: the plugins, and the public URL, which differs per environment.
 * The config is read by the server and by the admin screen, so it holds no secrets.
 */
export default defineConfig({
	schema,
	// Only read on the server (it is empty in the browser). The rest of `site` is in the schema file.
	site: { url: process.env.HOST_URL || undefined },
	plugins: [
		// Bodies are written as MDX in the directive notation (`:::callout{…}`), read and written both ways: this is how the maintainer writes posts.
		mdx({ syntax: [directiveSyntax()] }),
		// All body blocks: callout, collapsible, tabs, columns, Mermaid, chart, tooltip, code link, text color and code explorer.
		...blocks(),
		seo(),
		// The AI screen and buttons render without an API key (running an action needs a connection saved on the admin AI screen). The style guide is appended to the polish and draft instructions.
		aiPlugin({
			siteDescription: "A personal tech blog",
			shared: {
				styleGuide: {
					label: "Style guide",
					text: [
						"- Write posts and summaries in the plain declarative style.",
						"- When translating, follow the spelling developers of that language usually use for technical terms and product names.",
						"- Use the widely used spelling for technical names in slugs (nextjs, react-query, typescript).",
						"- End image captions with a short noun phrase (for example 'React Query setup screen').",
						"- Do not invent facts; mark what needs checking with [needs check].",
					].join("\n"),
				},
			},
		}),
		// Spell and sentence check (Bareun). The key is the server variable `BAREUN_API_KEY`; the button shows without it and the check answers "unavailable".
		bareun(),
	],
});

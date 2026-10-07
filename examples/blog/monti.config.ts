import { aiPlugin } from "@monti-cms/ai";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import {
	callout,
	chart,
	codeExplorer,
	codeRef,
	collapsible,
	color,
	columns,
	mermaid,
	tabs,
	tooltip,
} from "@monti-cms/blocks";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { gitSync } from "@monti-cms/git-sync";
import { mdx } from "@monti-cms/mdx";
import { seo } from "@monti-cms/seo";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import schema from "./monti.schema.json";
import { wordList } from "./plugins/word-list";

/**
 * The one config of the blog, and the CMS instance it makes. The admin API route, the admin screens, the site's pages and the `monti` command all use this `cms`.
 * It is server-only (it holds the database and login settings): it is never imported by a client component, and `monti doctor` checks that.
 *
 * A personal tech blog, modelled on the maintainer's own blog: posts, memos, categories, tags and series (the `collection` collection), in Korean (the default) and
 * English. The data of the site is in `monti.schema.json`: the collections and their fields and layouts (the SEO fields included), the locales, the time zone, the
 * site and admin settings, and the seed templates. Edit it there (editors autocomplete it through its `$schema`). `monti schema:types` writes `monti-env.d.ts` from
 * it, so `cms.read` and the admin know the collections without any type written by hand; `next dev` keeps that file up to date.
 * This file keeps what needs code: the plugins, the database and the login. Their values come from the environment (`.env.example` lists them).
 */
export const cms = defineConfig({
	schema,
	// The public site URL comes from SITE_URL. The rest of `site` is in the schema file.

	plugins: [
		// Bodies are written as MDX in the directive notation (`:::callout{…}`), read and written both ways: this is how the maintainer writes posts.
		mdx({ syntax: [directiveSyntax()] }),
		// The body blocks, one line each: delete a line and the block is gone. The inline marks (tooltip, code link, text color) are stored in this order when they overlap.
		callout(),
		collapsible(),
		tabs(),
		columns(),
		codeExplorer(),
		mermaid(),
		chart(),
		tooltip(),
		codeRef(),
		color(),
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
		// A spell check of your own, as a plugin of this app (see plugins/word-list). It replaces what used to be a separate admin-components file.
		wordList(),
		// Two-way sync of published entries with files in a GitHub repo (`@monti-cms/git-sync`). It is switched off here, so the example runs with no token and no repo.
		// To try it: set `enabled` to `true`, put your own repo in `targets`, run `pnpm db:migrate`, open /studio/git-sync, save a GitHub token (and a webhook secret) there,
		// and run `pnpm exec monti git-sync:push --all` once. The token is saved on that screen (encrypted with a key derived from MONTI_SECRET), never in this file. See the package README.
		gitSync({
			enabled: false,
			targets: [
				{
					repo: "your-name/your-content-repo",
					branch: "main",
					folder: "content",
					collections: ["post", "memo"],
					mode: "commit",
				},
			],
		}),
	],

	// The content database: DATABASE_URL, and DATABASE_SCHEMA when the database is shared.
	database: postgres(),

	// The admin login: AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (the OAuth app; its callback URL is `<site URL>/api/cms/auth/callback/github`) and MONTI_ADMIN_GITHUB_ID (the admin's
	// numeric GitHub id). Under `next dev` you are signed in as the admin without any of them, from this machine only; production never does that.
	auth: auth({ providers: [github()] }),

	// Media uploads: none here. A storage adapter from any package goes in `storage`.
	// storage: ...,

	// The one secret, MONTI_SECRET, signs the login session and encrypts the stored values (AI service keys, git-sync tokens).
	// Coming from the earlier setup, either set MONTI_SECRET to the old CMS_SECRET, or keep the old one readable: previousSecrets: [process.env.CMS_SECRET]
});

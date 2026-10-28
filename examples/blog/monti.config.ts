import { ai } from "@monti-cms/ai";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { callout, codeExplorer, codeRef, collapsible, color, columns, tabs, tooltip } from "@monti-cms/blocks";
// The two heavy blocks have their own entry points, so an app that does not use them never loads (or installs) mermaid and recharts.
import { chart } from "@monti-cms/blocks/chart";
import { mermaid } from "@monti-cms/blocks/mermaid";
import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import { seo } from "@monti-cms/seo";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { dummyStorage } from "./dummy-storage";
import schema from "./monti.schema";
import { siteCallout } from "./plugins/site-callout";
import { wordList } from "./plugins/word-list";

/**
 * The one config of the blog, and the CMS instance it makes. The admin API route, the admin screens, the site's pages and the `monti` command all use this `cms`.
 * It is server-only (it holds the database and login settings): it is never imported by a client component, and `monti doctor` checks that.
 *
 * A personal tech blog, modelled on the maintainer's own blog: posts, memos, categories, tags and series (the `collection` collection), in Korean (the default) and
 * English. The data of the site is in `monti.schema.ts`: the collections and their fields and layouts (the SEO fields included), the locales, the time zone, the
 * site and admin settings, and the seed templates. Edit it there (`defineSchema` types it, so the editor autocompletes it), or in the admin schema screen, which
 * writes the file again while it is plain data. `cms.read` and the admin know the collections from its types, without any type written by hand.
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
		ai({
			siteDescription: "A personal tech blog",
			snippets: {
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
		// Draws the site's own callout (components/callout.tsx) in the editor; the public page uses the same component (components/article-body.tsx).
		siteCallout(),
	],

	// The editor's width menu: the blog's real content width first (the editor starts there), then a phone width to check how a post wraps. "Full" is always added last.
	editor: {
		widths: [
			{ label: "Desktop", width: "720px" },
			{ label: "Mobile", width: "375px" },
		],
	},

	// The content database: DATABASE_URL, and DATABASE_SCHEMA when the database is shared.
	database: postgres(),

	// The admin login: AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (the OAuth app; its callback URL is `<site URL>/api/monti/auth/callback/github`) and MONTI_ADMIN_GITHUB_ID (the admin's
	// numeric GitHub id). Under `next dev` you are signed in as the admin without any of them, from this machine only; production never does that.
	auth: auth({ providers: [github()] }),

	// Media uploads: mock dummy storage for previewing the media library UI.
	storage: dummyStorage(),

	// The one secret, MONTI_SECRET, signs the login session and encrypts the stored values (AI service keys).
});

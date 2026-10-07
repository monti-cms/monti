import { chartBlock } from "../../blocks/src/definitions";
import { seoFields } from "../../seo/src/fields";
import { defineBlock, defineCollection, defineSite, fields } from "../src";

/**
 * Alternative site config used as a regression guard. Deliberately different from the reference blog config (`cms.config.ts`).
 * - Collections: article, topic, author (no post, memo, category, tag or collection from the blog)
 * - Fields: only the library convention `title` and the URL field `slug` are shared; all other names (`excerpt`, `topicIds`, `authorId`, `heroImage`,
 *   `metaTitle`, ...) and labels all differ. The title length limit also differs from the blog's (200 vs 120). SEO fields use different names and a different tab.
 * - Locales: English only. Blocks: only the chart from the blocks extension, plus site blocks (quote card, code fence map).
 *
 * Some core, admin and AI tests also run with this config (each package's `vitest.othersite.config.ts`). It is also type-checked
 * (`tsconfig.other-site.json`).
 */

const article = defineCollection({
	label: "Article",
	icon: "newspaper",
	kind: "document",
	path: "/blog/:slug/",
	fields: {
		title: fields.text({ label: "Headline", required: true, max: 120 }),
		slug: fields.slug({ label: "Permalink", from: "title", required: true }),
		// Summary and search values are found by role (`role`), not by name. Uses names different from the blog's.
		excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true, max: 300 }),
		authorId: fields.relation({ label: "Author", to: "author", required: true }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true, createInline: true }),
		heroImage: fields.text({ label: "Hero image", placeholder: "https://" }),
		format: fields.select({
			label: "Format",
			options: { news: "News", guide: "Guide", review: "Review" },
			defaultValue: "news",
		}),
		// Field group from the SEO extension. Different names, labels and tab (`Search`) from the blog, and the canonical URL is left out. Each field in the group gathers into that tab via its own `tab`.
		...seoFields({
			keys: {
				preview: "searchPreview",
				title: "metaTitle",
				description: "metaDescription",
				image: "shareImage",
				noindex: "hideFromSearch",
			},
			labels: {
				title: "Search title",
				description: "Search description",
				image: "Share image",
				noindex: "Hide from search",
			},
			omit: ["canonical"],
			tab: "Search",
			localized: false,
			limits: { title: 70 },
		}),
	},
	layout: [
		{ fields: ["title", "slug", "excerpt", "authorId", "topicIds"] },
		{ group: "Presentation", fields: ["heroImage", "format"] },
	],
	list: { columns: ["title", "status", "authorId", "topicIds", "format", "updatedAt"] },
});

const topic = defineCollection({
	label: "Topic",
	icon: "tag",
	kind: "item",
	fields: {
		title: fields.text({ label: "Name", required: true, max: 60 }),
		slug: fields.slug({ label: "Key", from: "title", required: true }),
	},
	list: { columns: ["title", "slug", "updatedAt"] },
});

const author = defineCollection({
	label: "Author",
	icon: "user",
	kind: "item",
	fields: {
		title: fields.text({ label: "Display name", required: true }),
		slug: fields.slug({ label: "Handle", from: "title", required: true }),
		bio: fields.text({ label: "Bio", multiline: true }),
	},
	list: { columns: ["title", "slug"] },
});

/** Site block: quote card (container). The public page renders it with the site's `QuoteCard` component. */
const quoteCard = defineBlock({
	name: "quote-card",
	label: "Quote card",
	syntax: { kind: "container", directive: "quote-card" },
	component: "QuoteCard",
	attributes: { author: { type: "string", label: "Author", translatable: true } },
	editor: { view: "node", insertable: true, keywords: ["quote", "card"] },
});

/** Site block: map (code fence). Stores the text inside the fence as is. */
const mapBlock = defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "MapEmbed",
	attributes: {},
	editor: { view: "node", insertable: true, keywords: ["map"], insert: { code: "lat 37.5\nlng 127.0" } },
});

export default defineSite({
	collections: { article, topic, author },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: {
		url: "https://example.org",
		name: "Example site",
		previewPath: "/preview",
		// URL rules different from the blog's: a prefix for every locale, the preview locale via the path, and the site view on a different host.
		localePrefix: "always",
		previewLocaleParam: false,
		home: "https://example.org/",
	},
	// The admin path also differs from the blog's (`/admin`).
	admin: { path: "/studio" },
	timeZone: "UTC",
	blocks: [chartBlock, quoteCard, mapBlock],
});

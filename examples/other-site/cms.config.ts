import { blocks } from "@monti-cms/blocks";
import { defineBlock, defineCollection, defineConfig, fields } from "@monti-cms/core";
import { seo, seoFields } from "@monti-cms/seo";

/**
 * An example site deliberately different from the main blog setup. Collections are article, topic and author; the only language is English.
 * Only the title field `title` and the address field `slug`, which the library requires, match the blog; the site picks every other field name and label.
 * From the blocks extension it installs only the chart and adds two site blocks (quote card and map).
 * It has the same shape as the other-site config used in the package tests (`packages/core/test/other-site.config.ts`).
 */

const article = defineCollection({
	label: "Article",
	icon: "newspaper",
	kind: "document",
	path: "/blog/:slug/",
	fields: {
		title: fields.text({ label: "Headline", required: true, max: 120 }),
		slug: fields.slug({ label: "Permalink", from: "title", required: true }),
		// Summary and search values are found by role (`role`), not by name. This site uses names that differ from the blog's.
		excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true, max: 300 }),
		authorId: fields.relation({ label: "Author", to: "author", required: true }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true, createInline: true }),
		heroImage: fields.text({ label: "Hero image", placeholder: "https://" }),
		format: fields.select({
			label: "Format",
			options: { news: "News", guide: "Guide", review: "Review" },
			defaultValue: "news",
		}),
		// Field group from the SEO extension. Uses names, labels and a tab (`Search`) that differ from the blog's, and leaves out the canonical URL. Each field in the group lands in that tab through its own `tab`.
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

/** Site block: map (code fence). The text inside the fence is stored as-is. */
const mapBlock = defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "MapEmbed",
	attributes: {},
	editor: { view: "node", insertable: true, keywords: ["map"], insert: { code: "lat 37.5\nlng 127.0" } },
});

export default defineConfig({
	collections: { article, topic, author },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	// URL rules also differ from the blog's: a prefix for every language (`/en/blog/...`), and the preview language comes from the path.
	site: { name: "Example site", previewPath: "/preview", localePrefix: "always", previewLocaleParam: false },
	// Admin screen path (`monti init --admin-path /studio`). Matches the route folder `app/(admin)/studio/`.
	admin: { path: "/studio" },
	timeZone: "UTC",
	// Install only the chart from the blocks extension (`blocks({ only })`) and add two site blocks. The SEO extension provides the search preview and hide switch.
	// The chart editor preview is drawn with the optional dependency `recharts`.
	plugins: [...blocks({ only: ["chart"] }), seo()],
	blocks: [quoteCard, mapBlock],
});

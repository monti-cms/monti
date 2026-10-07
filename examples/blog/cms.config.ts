import { aiPlugin } from "@monti-cms/ai";
import { bareun } from "@monti-cms/bareun";
import { blocks } from "@monti-cms/blocks";
import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import type { StoredDocument } from "@monti-cms/core/document";
import { mdx } from "@monti-cms/mdx";
import { seo, seoFields } from "@monti-cms/seo";
import { directiveSyntax } from "@monti-cms/syntax-directive";

/**
 * A personal tech blog, modelled on the maintainer's own blog: posts, memos, categories, tags and series (the `collection` collection), in Korean (the default) and English.
 * Everything the blog uses is attached: all body blocks, the SEO fields, the AI plugin, the Bareun spell checker, and MDX written in the directive notation (`:::callout{…}`).
 * The config is read by the server and by the admin screen, so it holds no secrets.
 */

const title = fields.text({
	label: "Title",
	required: true,
	max: 200,
	placeholder: "Untitled post",
	localized: true,
});
const slug = fields.slug({
	label: "Address",
	from: "title",
	required: true,
	placeholder: "url-friendly-slug",
	localized: "inherit",
});
const contentSlug = {
	...slug,
	description: "Changing the address of a published entry sends the old address to the new one with a 308 redirect.",
} as const;
const tagIds = fields.relation({
	label: "Tags",
	to: "tag",
	many: true,
	createInline: true,
	description: "Keeps the order you pick them in.",
});

/** The author records the working process. An entry that has none gets no status or experiment guessed for it. */
const recordFields = {
	recordStatus: fields.select({
		label: "Work status",
		defaultValue: "unspecified",
		options: {
			unspecified: "Not specified",
			experimental: "Experimenting",
			verified: "Verified",
			maintained: "Maintained",
			stale: "Needs review",
		},
		description: "Set by hand, apart from whether the entry is published.",
	}),
	recordObservation: fields.text({ label: "Observation / question", multiline: true, rows: 3, localized: true }),
	recordExperiment: fields.text({ label: "Attempt / experiment", multiline: true, rows: 3, localized: true }),
	recordResult: fields.text({ label: "Result / open question", multiline: true, rows: 3, localized: true }),
	relatedPostIds: fields.relation({ label: "Follow-up posts", to: "post", many: true, publishedOnly: true }),
	relatedMemoIds: fields.relation({ label: "Follow-up memos", to: "memo", many: true, publishedOnly: true }),
};
const recordLayout = {
	group: "Work log",
	fields: ["recordStatus", "recordObservation", "recordExperiment", "recordResult", "relatedPostIds", "relatedMemoIds"],
} as const;

/** Values for search engines and sharing (the SEO extension). Empty values fall back to the title, the summary and an automatic card. All fields sit in the SEO tab. */
const seoValues = seoFields({
	keys: {
		preview: "searchPreview",
		title: "seoTitle",
		description: "seoDescription",
		image: "ogImageId",
		noindex: "seoRobots",
		canonical: "canonicalUrl",
	},
});

export const post = defineCollection({
	label: "Post",
	icon: "file-text",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title,
		slug: contentSlug,
		summary: fields.text({
			label: "Summary",
			multiline: true,
			placeholder: "Intro shown in lists and search results",
			role: "summary",
			rows: 3,
			fillFromBody: true,
			localized: true,
		}),
		categoryId: fields.relation({ label: "Category", to: "category", required: true, createInline: true }),
		tagIds,
		series: fields.backlink({
			label: "Series",
			from: "collection",
			via: "itemIds",
			createInline: true,
			description:
				"Saved to the series at once, apart from the draft and publish state of the post. A new post goes to the end of the series.",
			placeholder: "Add to a series",
		}),
		policy: fields.conditional(
			fields.select({
				label: "Policy",
				description: "A deprecated post points readers to its replacement.",
				options: { normal: "Normal", evergreen: "Always current", deprecated: "Deprecated" },
				defaultValue: "normal",
			}),
			{
				/** The newer post to send readers to. */
				deprecated: {
					replacementPostId: fields.relation({
						label: "Replacement post",
						to: "post",
						publishedOnly: true,
						placeholder: "Pick a published post",
					}),
				},
			},
		),
		...recordFields,
		...seoValues,
	},
	layout: [
		{ fields: ["title", "slug", "summary"] },
		{ group: "Classification", fields: ["categoryId", "tagIds", "series"] },
		{ group: "Policy", fields: ["policy"] },
		recordLayout,
	],
});

export const memo = defineCollection({
	label: "Memo",
	icon: "notebook-pen",
	kind: "document",
	path: "/memos/:slug",
	fields: {
		title,
		slug: contentSlug,
		tagIds,
		series: fields.backlink({
			label: "Series",
			from: "collection",
			via: "memoIds",
			createInline: true,
			description:
				"Saved to the series at once, apart from the draft and publish state of the memo. Only series that hold memos can be picked, and a new memo goes to the end.",
			placeholder: "Add to a series",
		}),
		...recordFields,
		...seoValues,
	},
	layout: [{ fields: ["title", "slug"] }, { group: "Classification", fields: ["tagIds", "series"] }, recordLayout],
});

/** Only the name is per-language; the address and the relations are shared. */
const taxonomyFields = {
	title: fields.text({ label: "Name", required: true, max: 200, localized: true }),
	slug: fields.slug({ label: "Address", from: "title", required: true }),
} as const;

export const category = defineCollection({
	label: "Category",
	icon: "shapes",
	kind: "item",
	fields: taxonomyFields,
});

export const tag = defineCollection({
	label: "Tag",
	icon: "tag",
	kind: "item",
	fields: taxonomyFields,
});

export const series = defineCollection({
	label: "Series",
	icon: "layers",
	kind: "item",
	fields: {
		...taxonomyFields,
		summary: fields.text({ label: "Description", role: "summary", multiline: true, localized: true }),
		/**
		 * A series holds one kind of entry, posts or memos, in order. The post list keeps the key `itemIds`.
		 * Saving with another kind empties the list of the kind that is no longer picked.
		 */
		itemKind: fields.conditional(
			fields.select({
				label: "Holds",
				options: { post: "Posts", memo: "Memos" },
				defaultValue: "post",
				description: "Saving with another kind empties the list of the other kind.",
			}),
			{
				post: {
					itemIds: fields.relation({
						label: "Posts",
						to: "post",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "Unpublished posts can be added too; they only stay out of the public list.",
						placeholder: "Add or remove posts",
					}),
				},
				memo: {
					memoIds: fields.relation({
						label: "Memos",
						to: "memo",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "Unpublished memos can be added too; they only stay out of the public list.",
						placeholder: "Add or remove memos",
					}),
				},
			},
		),
	},
});

/** Seed templates are stored documents, so they need no text format. */
const text = (value: string) => ({ type: "text", text: value });
const heading = (level: number, value: string) => ({ type: "heading", attrs: { level }, content: [text(value)] });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
const codeBlock = (language: string) => ({ type: "codeBlock", attrs: { language, meta: "", code: "" } });
const storedDoc = (...content: unknown[]): StoredDocument => ({ type: "doc", version: 3, content }) as StoredDocument;

export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "Korean" },
		{ code: "en", name: "English", label: "English" },
	],
	defaultLocale: "ko",
	// A prefix for every language (`/ko/posts/…`), and the preview language comes from the path. `url` is only read on the server (it is empty in the browser).
	site: {
		url: process.env.HOST_URL || undefined,
		name: "Example blog",
		previewPath: "/preview",
		localePrefix: "always",
		previewLocaleParam: false,
	},
	// Admin screen path (`monti init --admin-path /studio`). Matches the route folder `app/(admin)/studio/`.
	admin: { path: "/studio" },
	timeZone: "Asia/Seoul",
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
	seed: {
		templates: [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "Algorithm solution",
				doc: storedDoc(heading(2, "Problem"), heading(2, "Solution"), codeBlock("ts")),
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Type Challenge solution",
				doc: storedDoc(heading(3, "Question"), codeBlock("ts"), heading(3, "Solution")),
			},
			{
				id: "00000000-0000-4000-8000-000000000003",
				name: "General post",
				doc: storedDoc(
					heading(2, "Overview"),
					paragraph("Introduce the core of the post."),
					heading(2, "Body"),
					heading(2, "Summary"),
					paragraph("Write the closing thoughts."),
				),
			},
		],
	},
});

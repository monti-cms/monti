/**
 * A small blog schema as JSON (a plain object, the way `JSON.parse` returns it), used by the schema file tests. It uses every field kind the format has:
 * text, slug, relation (one and many), select, media, conditional, backlink and view.
 */
export const blogSchema = {
	$schema: "./node_modules/@monti-cms/core/schema.json",
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			icon: "file-text",
			fields: {
				title: { kind: "text", label: "Title", required: true, max: 200, localized: true },
				slug: { kind: "slug", label: "Address", from: "title", required: true },
				summary: {
					kind: "text",
					label: "Summary",
					multiline: true,
					rows: 3,
					role: "summary",
					fillFromBody: { maxLength: 120 },
				},
				cover: { kind: "media", label: "Cover", accept: "image" },
				categoryId: { kind: "relation", label: "Category", to: "category", required: true },
				tagIds: { kind: "relation", label: "Tags", to: "tag", many: true, ordered: true },
				series: { kind: "backlink", label: "Series", from: "series", via: "postIds" },
				policy: {
					kind: "conditional",
					label: "Policy",
					discriminant: {
						kind: "select",
						label: "Policy",
						options: { normal: "Normal", deprecated: "Deprecated" },
						defaultValue: "normal",
					},
					values: {
						deprecated: { replacementId: { kind: "relation", label: "Replacement", to: "post" } },
					},
				},
				preview: { kind: "view", view: "search", tab: "SEO" },
			},
			layout: [
				{ fields: ["title", "slug", "summary"] },
				{ group: "Classification", fields: ["categoryId", "tagIds"], collapsed: true },
			],
			list: { columns: ["title", "status", "categoryId"] },
		},
		category: {
			label: "Category",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
			},
		},
		tag: {
			label: "Tag",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
			},
		},
		series: {
			label: "Series",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", from: "title" },
				postIds: { kind: "relation", label: "Posts", to: "post", many: true },
			},
		},
	},
	locales: [
		{ code: "ko", name: "한국어", label: "Korean" },
		{ code: "en", name: "English" },
	],
	defaultLocale: "ko",
	timeZone: "Asia/Seoul",
	site: { name: "Blog", localePrefix: "always", previewPath: "/preview" },
	admin: { path: "/studio", messages: { "cms-admin.entries": { publish: "Ship it" } } },
	seed: {
		templates: [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "General post",
				doc: { type: "doc", version: 3, content: [{ type: "paragraph", content: [{ type: "text", text: "Intro" }] }] },
			},
		],
	},
};

/** A deep copy that a test can edit without touching the fixture. */
/** A schema as `JSON.parse` returns it: a tree a test edits freely. */
// biome-ignore lint/suspicious/noExplicitAny: a test edits any part of the parsed JSON
export type EditableSchema = Record<string, any>;
export const cloneSchema = (): EditableSchema => JSON.parse(JSON.stringify(blogSchema));

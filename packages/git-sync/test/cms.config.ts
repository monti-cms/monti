import { defineCollection, defineSite, fields } from "@monti-cms/core";

/**
 * A small site for the git-sync tests: posts and memos (documents), tags (items), English (default) and Korean.
 * A post has a many-relation to tags, which shows how relations round-trip (by id).
 */
const title = fields.text({ label: "Title", required: true, max: 200, localized: true });
const slug = fields.slug({ label: "Slug", from: "title", required: true, localized: "inherit" });

export const post = defineCollection({
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title,
		slug,
		summary: fields.text({ label: "Summary", multiline: true, localized: true }),
		tagIds: fields.relation({ label: "Tags", to: "tag", many: true }),
		/** A single-valued relation (the owner's blog has `categoryId`). */
		categoryId: fields.relation({ label: "Category", to: "tag" }),
	},
});

export const memo = defineCollection({
	label: "Memo",
	kind: "document",
	path: "/memos/:slug",
	fields: { title, slug },
});

export const tag = defineCollection({
	label: "Tag",
	kind: "item",
	fields: {
		title: fields.text({ label: "Name", required: true, max: 200, localized: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
	},
});

/** The site without the plugins; a test adds `mdx()` and `gitSync(...)`. */
export const baseConfig = {
	collections: { post, memo, tag },
	locales: [
		{ code: "en", name: "English" },
		{ code: "ko", name: "한국어" },
	],
	defaultLocale: "en",
} as const;

export default defineSite(baseConfig);

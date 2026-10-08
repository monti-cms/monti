/**
 * The small blog every recipe test runs on: posts with tags (the `tag` collection holds small items). It is the same shape as the `monti.schema.json`
 * that `monti init` writes, kept in TypeScript with `as const` so that the types of `cms.read` follow it without running `monti schema:types`.
 */
export const schema = {
	collections: {
		post: {
			label: "Post",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true, max: 200 },
				slug: { kind: "slug", label: "Slug", from: "title", required: true },
				summary: { kind: "text", label: "Summary", role: "summary", multiline: true },
				tagIds: { kind: "relation", label: "Tags", to: "tag", many: true },
			},
		},
		tag: {
			label: "Tag",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Slug", from: "title", required: true },
			},
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
} as const;

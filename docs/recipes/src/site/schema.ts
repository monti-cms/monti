import { defineSchema } from "@monti-cms/core";

/** The small site the recipes are written for: posts with tags. */
export default defineSchema({
	schemaVersion: 3,
	collections: {
		post: {
			label: "Post",
			kind: "document",
			fields: {
				title: { kind: "text", label: "Title", required: true },
				slug: { kind: "slug", label: "Address", required: true, from: "title" },
				summary: { kind: "text", label: "Summary", role: "summary" },
				tagIds: { kind: "relation", label: "Tags", to: "tag", many: true },
				readingTime: { kind: "view", view: "reading-time", label: "Reading time" },
			},
		},
		tag: {
			label: "Tag",
			kind: "item",
			fields: {
				title: { kind: "text", label: "Name", required: true },
				slug: { kind: "slug", label: "Address", required: true, from: "title" },
			},
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});

import { defineSchema } from "@monti-cms/core";

/** The blog the screens' stories run on: two document collections and an item one, as the reference screens show them (the posts with their fields). */
export const schema = defineSchema({
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text", max: 120 },
				subtitle: { kind: "text" },
				cover: { kind: "media", accept: "image" },
				category: { kind: "relation", to: "category" },
			},
		},
		memo: {
			kind: "document",
			path: "/notes/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
		category: {
			kind: "item",
			path: "/categories/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

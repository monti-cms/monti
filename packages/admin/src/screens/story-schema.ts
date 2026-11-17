import { defineSchema } from "@monti-cms/core";

/** The blog the screens' stories run on, in Korean with English and Japanese translations: two document collections and an item one, as the reference screens show them (the posts with their fields). */
export const schema = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" }, // cms-allow-korean: the language's name in itself, sample data of the stories
			{ code: "en", name: "English" },
			{ code: "ja", name: "日本語" },
		],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text", max: 120, locale: "perLocale" },
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

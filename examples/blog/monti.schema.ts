import { defineSchema } from "@monti-cms/core";

// The site's structure. The admin's settings write this file on the dev server, so it holds values only, no code.
export default defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
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

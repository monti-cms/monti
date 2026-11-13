import { defineSchema } from "@monti-cms/core";

// The showcase's structure: every field kind, option and collection kind the core has. The admin's settings write this file on the dev
// server, so it holds values only, no code. `seed/seed.ts` fills it.
export default defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
			// Japanese is the partly translated language: some entries have no Japanese page, one has a draft with blocks left to translate.
			{ code: "ja", name: "日本語" },
		],
		prefix: "exceptSource",
	},
	collections: {
		// A document: a body, drafts, publishing, a preview page of the site's own.
		article: {
			kind: "document",
			path: "/articles/:slug",
			previewPath: "/preview/articles/:slug",
			fields: {
				title: { kind: "text", required: true },
				// The address follows the title until it is typed.
				slug: { kind: "slug", required: true, from: "title" },
				// Written per language, at most 160 characters, on more than one line.
				summary: { kind: "text", multiline: true, max: 160, locale: "perLocale" },
				// A translation starts from the source's value and may change it.
				subtitle: { kind: "text", locale: "fromSource" },
				// A required choice, one value for every language.
				topic: { kind: "select", options: ["guide", "news", "opinion"], required: true },
				// Several values.
				seasons: { kind: "select", options: ["spring", "summer", "autumn", "winter"], many: true },
				cover: { kind: "media", accept: "image" },
				// Any file the library takes: a picture, a PDF, a text file.
				attachment: { kind: "media", accept: "any" },
				// One item, from a collection with no public page.
				series: { kind: "relation", to: "series" },
				// Many items, in the order chosen; a tag that does not exist yet is made when it is typed.
				tags: { kind: "relation", to: "tag", many: true, ordered: true, createMissing: true },
				// Many, and the other side edits the same links (`person.articles`).
				authors: { kind: "relation", to: "person", many: true },
				// Entries of the same collection.
				related: { kind: "relation", to: "article", many: true, ordered: true },
				// A conditional field: each option has fields of its own, and one of them is a choice with fields again.
				format: {
					kind: "conditional",
					options: ["text", "video", "gallery", "link"],
					fields: {
						video: {
							// Required only when "video" is chosen.
							videoUrl: { kind: "text", required: true },
							videoLength: { kind: "text", max: 8 },
						},
						gallery: {
							galleryLayout: { kind: "select", options: ["grid", "carousel"] },
							galleryPoster: { kind: "media", accept: "image" },
						},
						link: {
							linkKind: {
								kind: "conditional",
								options: ["external", "internal"],
								fields: {
									external: { linkUrl: { kind: "text", required: true } },
									internal: { linkTarget: { kind: "relation", to: "article" } },
								},
							},
						},
					},
				},
				// A switch: one option, on or off, with fields while it is on.
				pinned: {
					kind: "conditional",
					control: "toggle",
					options: ["pinned"],
					fields: { pinned: { pinNote: { kind: "text", max: 80, locale: "perLocale" } } },
				},
			},
		},
		// A taxonomy: items with a public page each, live on save, made from an entry's field too.
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				description: { kind: "text", multiline: true, locale: "perLocale" },
			},
		},
		// Items with a page, linked from both sides: `articles` edits the articles' `authors`.
		person: {
			kind: "item",
			path: "/people/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				bio: { kind: "text", multiline: true, locale: "perLocale" },
				photo: { kind: "media", accept: "image" },
				roles: { kind: "select", options: ["writer", "photographer", "editor"], many: true },
				articles: { kind: "relation", to: "article", many: true, via: "authors" },
			},
		},
		// Data only: items with no page of their own, read where an article names them.
		series: {
			kind: "item",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				note: { kind: "text", locale: "perLocale" },
			},
		},
	},
});

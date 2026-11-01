import { type CmsConfig, defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite, type Site } from "@monti-cms/core/site";

/**
 * A small site of its own for the list's state, menus and filter fields, whose tests check how the list reads fields of each kind. Its shape is what
 * they name: a document collection with every kind the list filters by (text, media, select, relation, many relations), a conditional field and a
 * backlink; a second document collection without the single relation; two item collections; two languages; a time zone that is not UTC
 * (Seoul, nine hours ahead). The screen tests use the shared test site instead.
 */
const story = defineCollection({
	label: "Story",
	kind: "document",
	path: "/stories/:slug",
	fields: {
		title: fields.text({ label: "Title", required: true, localized: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
		lede: fields.text({ label: "Lede", multiline: true, role: "summary" }),
		deskId: fields.relation({ label: "Desk", to: "desk", required: true }),
		labelIds: fields.relation({ label: "Labels", to: "label", many: true }),
		shelves: fields.backlink({ label: "Shelves", from: "shelf", via: "storyIds" }),
		state: fields.conditional(
			fields.select({
				label: "State",
				options: { live: "Live", stale: "Stale", gone: "Gone" },
				defaultValue: "live",
			}),
			{ gone: { successorId: fields.relation({ label: "Successor", to: "story" }) } },
		),
		cover: fields.media({ label: "Cover" }),
	},
});

const note = defineCollection({
	label: "Note",
	kind: "document",
	path: "/notes/:slug",
	fields: {
		title: fields.text({ label: "Title", required: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
		labelIds: fields.relation({ label: "Labels", to: "label", many: true }),
		blurb: fields.text({ label: "Blurb" }),
	},
});

const taxonomy = {
	title: fields.text({ label: "Name", required: true, localized: true }),
	slug: fields.slug({ label: "Key", from: "title", required: true }),
} as const;
const desk = defineCollection({ label: "Desk", kind: "item", fields: taxonomy });
const label = defineCollection({ label: "Label", kind: "item", fields: taxonomy });
const shelf = defineCollection({
	label: "Shelf",
	kind: "item",
	fields: { ...taxonomy, storyIds: fields.relation({ label: "Stories", to: "story", many: true }) },
});

const config = defineSite({
	collections: { story, note, desk, label, shelf },
	locales: [
		{ code: "en", name: "English" },
		{ code: "de", name: "Deutsch" },
	],
	defaultLocale: "en",
	timeZone: "Asia/Seoul",
});

/** The site, with folders on (the default of a document collection), or with `story`'s folders switched on or off. */
export function listSite(options: { storyFolders?: boolean } = {}): Site {
	if (options.storyFolders === undefined) return createSite(config);
	return createSite({
		...config,
		collections: { ...config.collections, story: { ...story, folders: options.storyFolders } },
	} as CmsConfig);
}

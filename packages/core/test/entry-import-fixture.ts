import { defineCollection, defineSite, fields } from "../src/index";
import type { SourceEntry } from "../src/services/entry-import/types";
import { doc } from "./paragraphs-format";

/**
 * A site of the import tests' own, so they give the same result on any test config: notes keep their title in `title`, books in `headline`
 * (so an entry moved between them has to find its title under another name), and labels are an item collection. `de` is the default language.
 */
export const importConfig = defineSite({
	collections: {
		note: defineCollection({
			label: "Note",
			kind: "document",
			path: "/notes/:slug",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
			},
		}),
		book: defineCollection({
			label: "Book",
			kind: "document",
			path: "/books/:slug",
			fields: {
				headline: fields.text({ label: "Headline", role: "title", required: true }),
				slug: fields.slug({ label: "Slug", from: "headline", required: true }),
				isbn: fields.text({ label: "ISBN", required: true }),
			},
		}),
		label: defineCollection({
			label: "Label",
			kind: "item",
			fields: {
				title: fields.text({ label: "Name", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
			},
		}),
	},
	locales: [
		{ code: "de", name: "Deutsch" },
		{ code: "fr", name: "Français" },
	],
	defaultLocale: "de",
});

/** A paragraph of text. */
export const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

/** An entry of an archive as the reader gives it: by default a source note in the default language, with a title, a slug and a stored document. */
export const sourceEntry = (key: string, parts: Partial<SourceEntry> = {}): SourceEntry => ({
	key,
	collection: "note",
	locale: "de",
	group: key,
	isSource: true,
	title: null,
	slug: key,
	metadata: { title: `Title of ${key}` },
	published: false,
	body: { kind: "doc", doc: doc(paragraph(`Body of ${key}`)) },
	...parts,
});

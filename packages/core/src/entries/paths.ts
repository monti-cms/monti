import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { Schema } from "../schema/define";
import type { Entry } from "./record";

type Db = Kysely<Database> | Transaction<Database>;

/** A slug made from a title: letters and digits of any language, the rest joined by `-`. */
export const slugify = (text: string) =>
	text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80)
		.replace(/-+$/, "");

/**
 * The public path of a slug in a collection and language: its path with `:slug` filled in, after `/<language>` when the site's prefix rule shows the
 * language there (`always`, or `exceptSource` for a translation, doc 04).
 */
export function publicPath(schema: Schema, collection: string, slug: string, locale = schema.locales.source) {
	const path = schema.collections[collection]?.path?.replace(":slug", slug);
	if (path === undefined) return null;
	const { prefix, source } = schema.locales;
	return prefix === "always" || (prefix === "exceptSource" && locale !== source) ? `/${locale}${path}` : path;
}

/** Whether another entry of the same collection and language is published under `slug`. */
export async function slugPublishedByOther(db: Db, entry: Entry, slug: string): Promise<boolean> {
	const row = await db
		.selectFrom("entry_published")
		.select("entry_id")
		.where("collection", "=", entry.collection)
		.where("locale", "=", entry.locale)
		.where("slug", "=", slug)
		.where("entry_id", "<>", entry.id)
		.executeTakeFirst();
	return row !== undefined;
}

/**
 * The slug the entry publishes under, and whether another entry of the collection and language is published under it. An empty slug is a to-do that
 * blocks publishing (doc 02, 2026-11-06): publishing never makes one.
 */
export async function publishSlug(db: Db, entry: Entry): Promise<{ slug: string; taken: boolean }> {
	if (entry.slug === "") return { slug: "", taken: false };
	return { slug: entry.slug, taken: await slugPublishedByOther(db, entry, entry.slug) };
}

/** Where a preview opens an entry that has no slug yet: a stand-in made from the title, never saved. */
export const previewSlug = (entry: Entry) => entry.slug || slugify(entry.title) || entry.id.slice(0, 8);

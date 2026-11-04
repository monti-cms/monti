import { type Kysely, sql, type Transaction } from "kysely";
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

/** The public path of a slug in a collection: its path with `:slug` filled in. */
export const publicPath = (schema: Schema, collection: string, slug: string) =>
	schema.collections[collection]?.path.replace(":slug", slug) ?? null;

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
 * The slug the entry publishes under: its own, or for an empty one a slug from the title, with `-2`, `-3`… when another entry of the collection and
 * language has it, published or not (doc 02, flow 1 step 02).
 */
export async function publishSlug(db: Db, entry: Entry): Promise<{ slug: string; taken: boolean }> {
	if (entry.slug !== "") return { slug: entry.slug, taken: await slugPublishedByOther(db, entry, entry.slug) };
	const base = slugify(entry.title) || entry.id.slice(0, 8);
	const used = new Set(
		(
			await sql<{
				slug: string;
			}>`select slug from entries where collection = ${entry.collection} and locale = ${entry.locale} and id <> ${entry.id}
				union select slug from entry_published where collection = ${entry.collection} and locale = ${entry.locale} and entry_id <> ${entry.id}`.execute(
				db,
			)
		).rows.map((row) => row.slug),
	);
	let slug = base;
	for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
	return { slug, taken: false };
}

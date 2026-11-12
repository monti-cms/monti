import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { publicPath } from "../entries/paths";
import type { Schema } from "./define";

type Db = Kysely<Database> | Transaction<Database>;

/**
 * The most addresses one event lists. A changed language mark moves every published entry's address: on a large site that is tens of thousands of
 * paths, past what a webhook's body takes. Above this the event says the whole site changed (`allPaths`) and lists none.
 */
export const MOVED_PATHS_LIMIT = 1000;

/**
 * Whether going from one schema to another can move a public address: the language mark, a collection's path, a collection or a language gone, or
 * another source language where the mark depends on it. A change of fields alone moves none, and then the published entries are not read at all.
 */
export function canMoveAddresses(before: Schema, after: Schema): boolean {
	if (before.locales.prefix !== after.locales.prefix) return true;
	const marksSource = before.locales.prefix === "exceptSource" || after.locales.prefix === "exceptSource";
	if (marksSource && before.locales.source !== after.locales.source) return true;
	if (before.locales.list.some((locale) => !after.locales.list.some((each) => each.code === locale.code))) return true;
	return Object.entries(before.collections).some(
		([name, collection]) => after.collections[name]?.path !== collection.path,
	);
}

/** The public address of everything the site shows, by entry, as `schema` gives it (the collection's path and the language mark). */
async function publishedAddresses(db: Db, schema: Schema): Promise<Map<string, string>> {
	const rows = await db.selectFrom("entry_published").select(["entry_id", "collection", "locale", "slug"]).execute();
	const addresses = new Map<string, string>();
	for (const row of rows) {
		const address = publicPath(schema, row.collection, row.slug, row.locale);
		if (address !== null) addresses.set(row.entry_id, address);
	}
	return addresses;
}

/** The addresses before a structure change, read only when the change can move one; `null` when it cannot. */
export async function addressesBefore(db: Db, before: Schema, after: Schema): Promise<Map<string, string> | null> {
	return canMoveAddresses(before, after) ? publishedAddresses(db, before) : null;
}

/**
 * What a structure change tells of the addresses it touched: the old and the new one of every published entry whose address is no longer what it
 * was (a changed language mark or collection path), and the old one of what left the site with a language or a collection. A site that keeps its
 * pages refreshes these (doc 16). More than `MOVED_PATHS_LIMIT` of them are not listed: the event says the whole site changed.
 */
export async function movedAddresses(
	db: Db,
	before: Map<string, string> | null,
	after: Schema,
): Promise<{ paths: string[] } | { allPaths: true }> {
	if (before === null) return { paths: [] };
	const now = await publishedAddresses(db, after);
	const moved = new Set<string>();
	for (const [entry, old] of before) {
		const next = now.get(entry);
		if (next === old) continue;
		moved.add(old);
		if (next !== undefined) moved.add(next);
	}
	for (const [entry, next] of now) if (!before.has(entry)) moved.add(next);
	return moved.size > MOVED_PATHS_LIMIT ? { allPaths: true } : { paths: [...moved].sort() };
}

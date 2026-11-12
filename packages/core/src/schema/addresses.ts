import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { publicPath } from "../entries/paths";
import type { Schema } from "./define";

type Db = Kysely<Database> | Transaction<Database>;

/** The public address of everything the site shows, by entry, as `schema` gives it (the collection's path and the language mark). */
export async function publishedAddresses(db: Db, schema: Schema): Promise<Map<string, string>> {
	const rows = await db.selectFrom("entry_published").select(["entry_id", "collection", "locale", "slug"]).execute();
	const addresses = new Map<string, string>();
	for (const row of rows) {
		const address = publicPath(schema, row.collection, row.slug, row.locale);
		if (address !== null) addresses.set(row.entry_id, address);
	}
	return addresses;
}

/**
 * The addresses a structure change touched: the old and the new one of every published entry whose address is no longer what it was (a changed
 * language mark or collection path), and the old one of what left the site with a language or a collection. A site that keeps its pages refreshes
 * these (doc 16).
 */
export function movedAddresses(before: Map<string, string>, after: Map<string, string>): string[] {
	const moved = new Set<string>();
	for (const [entry, old] of before) {
		const now = after.get(entry);
		if (now === old) continue;
		moved.add(old);
		if (now !== undefined) moved.add(now);
	}
	for (const [entry, now] of after) if (!before.has(entry)) moved.add(now);
	return [...moved].sort();
}

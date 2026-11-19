import { sql } from "kysely";
import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";

/** What the entry actions return of an entry: the same shape for the working copy and the published copy. */
export interface Entry {
	id: string;
	collection: string;
	locale: string;
	source_entry_id: string | null;
	folder_id: string | null;
	slug: string;
	data: Record<string, unknown>;
	published_at: Date | null;
}

/** Which entry `entries.get` reads: by `id`, or by `collection`, `locale` and `slug`. */
type EntryKey = { id: string } | { collection: string; locale: string; slug: string };

interface ListFilter {
	collection?: string;
	locale?: string;
	folder_id?: string | null;
	relation?: { field: string; id: string };
}

const IDENTITY = [
	"entries.id",
	"entries.collection",
	"entries.locale",
	"entries.source_entry_id",
	"entries.folder_id",
] as const;

/** The working copies of the active entries, with when each was published. */
function draftView(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.leftJoin("entry_published", "entry_published.entry_id", "entries.id")
		.select([...IDENTITY, "entries.slug", "entries.data", "entry_published.published_at"])
		.where("entries.trashed_at", "is", null)
		.$castTo<Entry>()
		.as("entry");
}

/** The published copies of the active entries that have one. */
function publishedView(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.innerJoin("entry_published", "entry_published.entry_id", "entries.id")
		.select([...IDENTITY, "entry_published.slug", "entry_published.data", "entry_published.published_at"])
		.where("entries.trashed_at", "is", null)
		.$castTo<Entry>()
		.as("entry");
}

/** The working copies when `draft` is true, else the published copies, as the table `entry`. */
function entryView(ctx: ReadContext, draft: boolean | undefined) {
	return ctx.db.selectFrom(draft === true ? draftView(ctx) : publishedView(ctx)).selectAll();
}

/** The entry `key` names in the view `draft` picks; rejects one the view does not have. */
export async function findEntry(ctx: ReadContext, key: EntryKey, draft: boolean | undefined): Promise<Entry> {
	let query = entryView(ctx, draft);
	query =
		"id" in key
			? query.where("entry.id", "=", key.id)
			: query
					.where("entry.collection", "=", key.collection)
					.where("entry.locale", "=", key.locale)
					.where("entry.slug", "=", key.slug);
	const entry = await query.executeTakeFirst();
	if (entry === undefined) throw new MontiError("NOT_FOUND", "No entry matches");
	return entry;
}

/**
 * The entries in the view `draft` picks that match every given filter. `folder_id` null is the root; `relation` matches a
 * field holding the id itself or a list with it.
 */
export async function listEntries(ctx: ReadContext, filter: ListFilter, draft: boolean | undefined): Promise<Entry[]> {
	let query = entryView(ctx, draft);
	if (filter.collection !== undefined) query = query.where("entry.collection", "=", filter.collection);
	if (filter.locale !== undefined) query = query.where("entry.locale", "=", filter.locale);
	if (filter.folder_id === null) query = query.where("entry.folder_id", "is", null);
	if (typeof filter.folder_id === "string") query = query.where("entry.folder_id", "=", filter.folder_id);
	if (filter.relation !== undefined) {
		const { field, id } = filter.relation;
		query = query.where(
			sql<boolean>`${sql.ref("entry.data")} -> 'fields' -> ${field}::text @> to_jsonb(${id.toLowerCase()}::text)`,
		);
	}
	return query.execute();
}

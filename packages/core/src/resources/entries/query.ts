import { sql } from "kysely";
import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";

/** What the entry actions return of an entry in one locale: the same shape for the working copy and the published copy. */
export interface Entry {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	folder_id: string | null;
	slug: string;
	data: Record<string, unknown>;
	published_at: Date | null;
}

/** Which entry `entries.get` reads: by `id` and `locale` (its source locale when left out), or by its slug. */
type EntryKey = { id: string; locale?: string } | { collection: string; locale: string; slug: string };

interface ListFilter {
	collection?: string;
	locale?: string;
	folder_id?: string | null;
	relation?: { field: string; id: string };
}

const SHARED = ["entries.id", "entries.collection", "entries.source_locale", "entries.folder_id"] as const;

/** The working copies of the active entries in every locale, with when each was published. */
function draftView(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.innerJoin("entry_locales", "entry_locales.entry_id", "entries.id")
		.leftJoin("entry_published", (join) =>
			join
				.onRef("entry_published.entry_id", "=", "entry_locales.entry_id")
				.onRef("entry_published.locale", "=", "entry_locales.locale"),
		)
		.select([
			...SHARED,
			"entry_locales.locale",
			"entry_locales.slug",
			"entry_locales.data",
			"entry_published.published_at",
		])
		.where("entries.trashed_at", "is", null)
		.$castTo<Entry>()
		.as("entry");
}

/** The published copies of the active entries in every locale that has one. */
function publishedView(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.innerJoin("entry_published", "entry_published.entry_id", "entries.id")
		.select([
			...SHARED,
			"entry_published.locale",
			"entry_published.slug",
			"entry_published.data",
			"entry_published.published_at",
		])
		.where("entries.trashed_at", "is", null)
		.$castTo<Entry>()
		.as("entry");
}

/** The working copies when `draft` is true, else the published copies, as the table `entry`. */
export function entryView(ctx: ReadContext, draft: boolean | undefined) {
	return ctx.db.selectFrom(draft === true ? draftView(ctx) : publishedView(ctx)).selectAll();
}

/** The entry `key` names in the view `draft` picks; rejects one the view does not have in that locale. */
export async function findEntry(ctx: ReadContext, key: EntryKey, draft: boolean | undefined): Promise<Entry> {
	let query = entryView(ctx, draft);
	if ("id" in key) query = query.where("entry.id", "=", key.id);
	else query = query.where("entry.collection", "=", key.collection).where("entry.slug", "=", key.slug);
	query =
		key.locale === undefined
			? query.whereRef("entry.locale", "=", "entry.source_locale")
			: query.where("entry.locale", "=", key.locale);
	const entry = await query.executeTakeFirst();
	if (entry === undefined) throw new MontiError("NOT_FOUND", "No entry matches");
	return entry;
}

/**
 * The entries in the view `draft` picks that match every given filter, in `locale`, or each in its source locale when it
 * is left out. `folder_id` null is the root; `relation` matches a field holding the id itself or a list with it.
 */
export async function listEntries(ctx: ReadContext, filter: ListFilter, draft: boolean | undefined): Promise<Entry[]> {
	let query = entryView(ctx, draft);
	if (filter.collection !== undefined) query = query.where("entry.collection", "=", filter.collection);
	query =
		filter.locale === undefined
			? query.whereRef("entry.locale", "=", "entry.source_locale")
			: query.where("entry.locale", "=", filter.locale);
	if (filter.folder_id === null) query = query.where("entry.folder_id", "is", null);
	if (typeof filter.folder_id === "string") query = query.where("entry.folder_id", "=", filter.folder_id);
	if (filter.relation !== undefined) {
		const { field, id } = filter.relation;
		query = query.where(sql<boolean>`${sql.ref("entry.data")} -> 'fields' -> ${field}::text @> to_jsonb(${id}::text)`);
	}
	return query.execute();
}

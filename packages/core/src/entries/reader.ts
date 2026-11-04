import type { Kysely } from "kysely";
import type { Database } from "../db/schema";
import type { Schema } from "../schema/define";
import { publicPath } from "./paths";
import { readPreviewToken } from "./preview";

/** An entry as the site reads it: only the fields the schema has now (doc 01). */
export type SiteEntry = {
	id: string;
	collection: string;
	locale: string;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: unknown | null;
	publishedAt: Date | null;
};

export type ReaderOptions = {
	db: Kysely<Database>;
	schema: Schema;
	/** `MONTI_SECRET`, to open preview links. Without it the reader never shows a working copy. */
	secret?: string | null;
	now?: () => Date;
};

const onlySchemaFields = (schema: Schema, collection: string, values: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(values).filter(([field]) => schema.collections[collection]?.fields[field]));

/**
 * How the site reads entries (doc 02): what was published, never the working copy, except for the one entry a valid preview link opens. A slug an
 * entry was published under before answers with a redirect to where it is now.
 */
export function createReader(options: ReaderOptions) {
	const { db, schema } = options;
	const now = options.now ?? (() => new Date());
	return {
		async entry(where: {
			collection: string;
			slug: string;
			locale: string;
			/** The `token` of `entries.previewLink`. */
			preview?: string;
		}): Promise<{ entry: SiteEntry } | { redirect: string } | null> {
			const previewId = where.preview && options.secret ? readPreviewToken(options.secret, where.preview, now()) : null;
			if (previewId) {
				const row = await db
					.selectFrom("entries")
					.selectAll()
					.where("id", "=", previewId)
					.where("collection", "=", where.collection)
					.executeTakeFirst();
				if (row)
					return {
						entry: {
							id: row.id,
							collection: row.collection,
							locale: row.locale,
							title: row.title,
							slug: row.slug,
							values: onlySchemaFields(schema, row.collection, row.values),
							doc: row.doc,
							publishedAt: null,
						},
					};
			}
			const copy = await db
				.selectFrom("entry_published")
				.selectAll()
				.where("collection", "=", where.collection)
				.where("locale", "=", where.locale)
				.where("slug", "=", where.slug)
				.executeTakeFirst();
			if (copy)
				return {
					entry: {
						id: copy.entry_id,
						collection: copy.collection,
						locale: copy.locale,
						title: copy.title,
						slug: copy.slug,
						values: onlySchemaFields(schema, copy.collection, copy.values),
						doc: copy.doc,
						publishedAt: copy.published_at,
					},
				};
			const moved = await db
				.selectFrom("old_paths")
				.innerJoin("entry_published", "entry_published.entry_id", "old_paths.entry_id")
				.select("entry_published.slug")
				.where("old_paths.collection", "=", where.collection)
				.where("old_paths.locale", "=", where.locale)
				.where("old_paths.slug", "=", where.slug)
				.executeTakeFirst();
			const path = moved && publicPath(schema, where.collection, moved.slug);
			return path ? { redirect: path } : null;
		},

		/** The published entries of a collection and language, newest first. */
		async entries(where: { collection: string; locale: string }): Promise<SiteEntry[]> {
			const rows = await db
				.selectFrom("entry_published")
				.selectAll()
				.where("collection", "=", where.collection)
				.where("locale", "=", where.locale)
				.orderBy("published_at", "desc")
				.execute();
			return rows.map((copy) => ({
				id: copy.entry_id,
				collection: copy.collection,
				locale: copy.locale,
				title: copy.title,
				slug: copy.slug,
				values: onlySchemaFields(schema, copy.collection, copy.values),
				doc: copy.doc,
				publishedAt: copy.published_at,
			}));
		},
	};
}

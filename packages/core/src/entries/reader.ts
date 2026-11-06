import type { Kysely } from "kysely";
import { asDoc, type Doc } from "../body/doc";
import { linkedGroups } from "../body/links";
import type { Database } from "../db/schema";
import type { Schema } from "../schema/define";
import { siteDoc, translatedFields } from "../translations/source";
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
	/**
	 * An entry as the site gets it (doc 04): no pending block, and in a translation the source's published blocks for `followSource` ones and the
	 * source's values for `same` fields and empty `fromSource` ones. While the source is not on the site, a translation keeps its own values.
	 */
	async function forSite(entry: SiteEntry): Promise<SiteEntry> {
		const doc = entry.doc === null || entry.doc === undefined ? null : asDoc(entry.doc);
		if (entry.locale === schema.locales.source) return { ...entry, doc: doc && siteDoc(doc, null) };
		const source = await db
			.selectFrom("entries as e")
			.innerJoin("entries as s", (join) =>
				join
					.onRef("s.translation_group", "=", "e.translation_group")
					.on("s.locale", "=", schema.locales.source)
					.on("s.trashed_at", "is", null),
			)
			.innerJoin("entry_published as sp", "sp.entry_id", "s.id")
			.select(["sp.title", "sp.slug", "sp.values", "sp.doc"])
			.where("e.id", "=", entry.id)
			.executeTakeFirst();
		const fields = translatedFields(
			schema,
			entry.collection,
			{ title: entry.title, slug: entry.slug, values: entry.values },
			source ?? null,
		);
		return {
			...entry,
			title: fields.title,
			values: onlySchemaFields(schema, entry.collection, fields.values),
			doc: doc && siteDoc(doc, source ? asDoc(source.doc) : null),
		};
	}
	return {
		async entry(where: {
			collection: string;
			slug: string;
			locale: string;
			/** The `token` of `entries.previewLink`. */
			preview?: string;
		}): Promise<{ entry: SiteEntry } | { redirect: string } | null> {
			const previewId =
				where.preview && options.secret ? await readPreviewToken(options.secret, where.preview, now()) : null;
			if (previewId) {
				const row = await db
					.selectFrom("entries")
					.selectAll()
					.where("id", "=", previewId)
					.where("collection", "=", where.collection)
					.executeTakeFirst();
				if (row)
					return {
						entry: await forSite({
							id: row.id,
							collection: row.collection,
							locale: row.locale,
							title: row.title,
							slug: row.slug,
							values: onlySchemaFields(schema, row.collection, row.values),
							doc: row.doc,
							publishedAt: null,
						}),
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
					entry: await forSite({
						id: copy.entry_id,
						collection: copy.collection,
						locale: copy.locale,
						title: copy.title,
						slug: copy.slug,
						values: onlySchemaFields(schema, copy.collection, copy.values),
						doc: copy.doc,
						publishedAt: copy.published_at,
					}),
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

		/** The paths of the entries a body links to that are on the site in this language, by translation group: `renderDocument`'s `entryPath`. */
		async linkPaths(doc: Doc, locale: string): Promise<Record<string, string>> {
			const groups = linkedGroups(doc);
			if (groups.length === 0) return {};
			const rows = await db
				.selectFrom("entry_published")
				.innerJoin("entries", "entries.id", "entry_published.entry_id")
				.select(["entries.translation_group as group", "entry_published.collection", "entry_published.slug"])
				.where("entries.translation_group", "in", groups)
				.where("entry_published.locale", "=", locale)
				.execute();
			return Object.fromEntries(
				rows.flatMap((row) => {
					const path = publicPath(schema, row.collection, row.slug);
					return path ? [[row.group, path]] : [];
				}),
			);
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
			return Promise.all(
				rows.map((copy) =>
					forSite({
						id: copy.entry_id,
						collection: copy.collection,
						locale: copy.locale,
						title: copy.title,
						slug: copy.slug,
						values: onlySchemaFields(schema, copy.collection, copy.values),
						doc: copy.doc,
						publishedAt: copy.published_at,
					}),
				),
			);
		},
	};
}

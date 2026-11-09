import type { Kysely } from "kysely";
import { asDoc, type Doc } from "../body/doc";
import { linkedGroups } from "../body/links";
import type { Database } from "../db/schema";
import type { Storage } from "../media/storage";
import { usesInDoc, usesInValues } from "../media/uses";
import type { Schema } from "../schema/define";
import { siteDoc, translatedFields } from "../translations/source";
import { publicPath } from "./paths";
import { readPreviewToken } from "./preview";

/** A relation item as resolved on the site (doc 08). */
export type ResolvedRelation = {
	id: string;
	group: string;
	collection: string;
	locale: string;
	slug: string;
	title: string;
	values: Record<string, unknown>;
	fallback?: boolean;
};

/** A media file as the site uses it: the web size when there is one, the original when it is small enough already (doc 09). */
export type SiteMedia = {
	id: string;
	name: string;
	kind: "image" | "file";
	mime: string;
	size: number;
	url: string;
	width: number | null;
	height: number | null;
};

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
	relations?: Record<string, ResolvedRelation | ResolvedRelation[] | null>;
	/** The media files its fields and body use, by id. There only when the site has a storage and the entry uses a file. */
	media?: Record<string, SiteMedia>;
};

export type ReaderOptions = {
	db: Kysely<Database>;
	schema: Schema;
	/** `MONTI_SECRET`, to open preview links. Without it the reader never shows a working copy. */
	secret?: string | null;
	now?: () => Date;
	/** Where media files are (`monti.site.storage`). Without it an entry's files have no addresses to give. */
	storage?: Storage | null;
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

	/** Adds the files an entry uses, so the site can draw them (`renderDocument`'s `mediaUrl` and `mediaSize`). */
	async function withMedia(entry: SiteEntry): Promise<SiteEntry> {
		const { storage } = options;
		if (!storage) return entry;
		const fields = schema.collections[entry.collection]?.fields ?? {};
		const ids = [...new Set([...usesInValues(fields, entry.values), ...usesInDoc(entry.doc)].map((use) => use.media))];
		if (ids.length === 0) return entry;
		const rows = await db.selectFrom("media").selectAll().where("id", "in", ids).execute();
		if (rows.length === 0) return entry;
		return {
			...entry,
			media: Object.fromEntries(
				rows.map((row) => [
					row.id,
					{
						id: row.id,
						name: row.name,
						kind: row.kind,
						mime: row.mime,
						size: row.size,
						url: storage.url(row.web_key ?? row.original_key),
						width: row.web_key ? row.web_width : row.original_width,
						height: row.web_key ? row.web_height : row.original_height,
					},
				]),
			),
		};
	}

	/**
	 * An entry as the site gets it (doc 04): no pending block, and in a translation the source's published blocks for `followSource` ones and the
	 * source's values for `same` fields and empty `fromSource` ones. While the source is not on the site, a translation keeps its own values.
	 */
	async function forSite(entry: SiteEntry): Promise<SiteEntry> {
		const doc = entry.doc === null || entry.doc === undefined ? null : asDoc(entry.doc);
		let base: SiteEntry;
		if (entry.locale === schema.locales.source) {
			base = { ...entry, doc: doc && siteDoc(doc, null) };
		} else {
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
			base = {
				...entry,
				title: fields.title,
				values: onlySchemaFields(schema, entry.collection, fields.values),
				doc: doc && siteDoc(doc, source ? asDoc(source.doc) : null),
			};
		}

		// Resolve relations
		const colDef = schema.collections[base.collection];
		const relationFields = Object.entries(colDef?.fields ?? {}).filter(([, f]) => f.kind === "relation");
		if (relationFields.length === 0) return withMedia(base);

		const relations: Record<string, ResolvedRelation | ResolvedRelation[] | null> = {};
		for (const [fieldName, fieldDef] of relationFields) {
			if (fieldDef.kind !== "relation") continue;
			const targetCol = fieldDef.to;
			const val = base.values[fieldName];
			const isMany = Boolean(fieldDef.many);

			let targetGroups: string[] = [];
			if (Array.isArray(val)) {
				targetGroups = val.filter((v): v is string => typeof v === "string" && Boolean(v));
			} else if (typeof val === "string" && val) {
				targetGroups = [val];
			}

			if (targetGroups.length === 0) {
				relations[fieldName] = isMany ? [] : null;
				continue;
			}

			const candidates = await db
				.selectFrom("entry_published as p")
				.innerJoin("entries as e", "e.id", "p.entry_id")
				.select(["e.id", "e.translation_group", "p.collection", "p.locale", "p.slug", "p.title", "p.values"])
				.where("p.collection", "=", targetCol)
				.where("e.translation_group", "in", targetGroups)
				.where("e.trashed_at", "is", null)
				.where("p.locale", "in", [base.locale, schema.locales.source])
				.execute();

			const resolveOne = (group: string): ResolvedRelation | null => {
				const groupCandidates = candidates.filter((c) => c.translation_group === group);
				const match =
					groupCandidates.find((c) => c.locale === base.locale) ??
					groupCandidates.find((c) => c.locale === schema.locales.source);
				if (!match) return null;
				return {
					id: match.id,
					group: match.translation_group,
					collection: match.collection,
					locale: match.locale,
					slug: match.slug,
					title: match.title,
					values: match.values as Record<string, unknown>,
					fallback: match.locale !== base.locale,
				};
			};

			if (isMany) {
				const list: ResolvedRelation[] = [];
				for (const g of targetGroups) {
					const r = resolveOne(g);
					if (r) list.push(r);
				}
				relations[fieldName] = list;
			} else {
				relations[fieldName] = resolveOne(targetGroups[0]);
			}
		}

		return withMedia({ ...base, relations });
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
					.where("trashed_at", "is", null)
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
				.selectFrom("entry_published as p")
				.innerJoin("entries as e", "e.id", "p.entry_id")
				.selectAll("p")
				.where("p.collection", "=", where.collection)
				.where("p.locale", "=", where.locale)
				.where("p.slug", "=", where.slug)
				.where("e.trashed_at", "is", null)
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
				.innerJoin("entries", "entries.id", "entry_published.entry_id")
				.select("entry_published.slug")
				.where("old_paths.collection", "=", where.collection)
				.where("old_paths.locale", "=", where.locale)
				.where("old_paths.slug", "=", where.slug)
				.where("entries.trashed_at", "is", null)
				.executeTakeFirst();
			const path = moved && publicPath(schema, where.collection, moved.slug, where.locale);
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
					const path = publicPath(schema, row.collection, row.slug, locale);
					return path ? [[row.group, path]] : [];
				}),
			);
		},

		/** The published entries of a collection and language, newest first. */
		async entries(where: { collection: string; locale: string }): Promise<SiteEntry[]> {
			const isItem = schema.collections[where.collection]?.kind === "item";
			let query = db
				.selectFrom("entry_published as p")
				.innerJoin("entries as e", "e.id", "p.entry_id")
				.selectAll("p")
				.where("p.collection", "=", where.collection)
				.where("p.locale", "=", where.locale)
				.where("e.trashed_at", "is", null);
			if (isItem) {
				query = query.orderBy("e.position", "asc").orderBy("p.published_at", "desc");
			} else {
				query = query.orderBy("p.published_at", "desc");
			}
			const rows = await query.execute();
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

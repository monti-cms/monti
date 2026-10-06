import { isCollection } from "../../../core/collections";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { CmsError } from "../../../core/store/errors";
import type { EntryMetadata, PublishedEntryLookup, PublishedEntryRecord } from "../../../core/store/types";
import {
	mergeTranslationMetadata,
	RECORD_TRANSLATIONS_KEY,
	recordLocalizedFields,
	storedField,
} from "../../../schema/derive";
import type { StoreContext } from "./context";
import { mapPublishedEntryRow } from "./rows";

function assertPublicCollections(collections: readonly string[]): void {
	if (!Array.isArray(collections) || collections.length === 0) {
		throw new CmsError("Invalid collections", "invalid_input");
	}
	for (const collection of collections) {
		if (typeof collection !== "string" || !isCollection(collection)) {
			throw new CmsError("Invalid collection", "invalid_input");
		}
	}
}

type PublishedRow = {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	slug: string;
	metadata: EntryMetadata;
	source_metadata: EntryMetadata;
	doc: unknown;
	published_at: Date | null;
	body_updated_at: Date;
};

/**
 * A translation is read together with its source's published version. If the source is not published, the translation is not in the public layer either.
 * For a source, `src` is itself.
 */
const sourceJoin = (qSchema: string) => `JOIN "${qSchema}".entries src
	   ON src.id = COALESCE(e.translation_group_id, e.id) AND src.status = 'published'
	 JOIN "${qSchema}".entry_bodies sb
	   ON sb.entry_id = src.id AND sb.state = 'published'`;

/** The publish date is the source's (a translation uses the source date too). The modified date is that of this language's body. */
const PUBLISHED_COLUMNS = (withBody: boolean, address = "a") =>
	`e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
	 ${address}.slug AS slug, b.metadata, sb.metadata AS source_metadata,
	 ${withBody ? "b.doc" : "NULL::jsonb"} AS doc,
	 src.published_at, b.updated_at AS body_updated_at`;

/** Translation metadata = the source's shared values + the translation's per-language values. */
function mapPublishedRow(row: PublishedRow): PublishedEntryRecord {
	const isTranslation = row.translation_group_id !== row.id;
	const metadata =
		isTranslation && isCollection(row.collection)
			? (mergeTranslationMetadata(row.collection, row.source_metadata, row.metadata) as EntryMetadata)
			: row.metadata;
	return mapPublishedEntryRow({ ...row, metadata });
}

/** Public list sort. Publish date is the source's, modified date is this language body's, title is this language's title. */
export type PublishedSort = "publishedAt" | "updatedAt" | "title";

export interface PublishedPageParams {
	readonly collection: string;
	/** Only this language's content. Defaults to the default language. */
	readonly locale?: string;
	/** Relation field name to selected item IDs. Multiple values of the same field are OR; different fields are AND. */
	readonly where?: Readonly<Record<string, string | readonly string[]>>;
	readonly sort?: PublishedSort;
	/**
	 * Display language used for title sorting. An item collection keeps one default-language record with per-language names (`translations`), so it sorts
	 * by that language's name (falling back to the default name). If unset, `locale`.
	 */
	readonly titleLocale?: string;
	readonly order?: "asc" | "desc";
	/** 1-based. */
	readonly page?: number;
	/** 1 to 500. Default 25. */
	readonly pageSize?: number;
	readonly includeBody?: boolean;
}

const SORT_COLUMNS: Record<PublishedSort, string> = {
	publishedAt: "src.published_at",
	updatedAt: "b.updated_at",
	title: "b.metadata->>'title'",
};

/**
 * Public reads only. Public pages, RSS, sitemap, and OG call it on every request.
 * It requires both a published body and published status, so drafts, archived, and trashed entries are never returned by any path.
 */
export function createPublicReadOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;
	return {
		listPublishedEntries: async (params: {
			collections: readonly string[];
			includeBody?: boolean;
			/** Only this language's content. All languages if unset. Record collections have only the default language. */
			locale?: string;
		}): Promise<PublishedEntryRecord[]> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			assertPublicCollections(params.collections);
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}
			if (params.locale !== undefined && typeof params.locale !== "string") {
				throw new CmsError("Invalid locale", "invalid_input");
			}

			const res = await pool.query<PublishedRow>(
				`SELECT ${PUBLISHED_COLUMNS(params.includeBody === true)}
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE e.status = 'published' AND e.collection = ANY($1::text[])
				   AND ($2::text IS NULL OR e.locale = $2)
				 ORDER BY b.updated_at DESC, e.id ASC`,
				[params.collections, params.locale ?? null],
			);

			return res.rows.map(mapPublishedRow);
		},

		// If the requested slug is a former address (alias), return the entry that owns the canonical current slug.
		// If the same string exists as both alias and current, current wins.
		// Entries with no current slug are not returned (reserved and deleted slugs are not in the public layer).
		getPublishedEntryBySlug: async (params: {
			collection: string;
			slug: string;
			includeBody?: boolean;
			/** Language of the slug. Defaults to the default language. */
			locale?: string;
		}): Promise<PublishedEntryLookup> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			if (typeof params.collection !== "string" || !isCollection(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			if (typeof params.slug !== "string" || params.slug.length === 0) {
				throw new CmsError("Invalid slug", "invalid_input");
			}
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}

			const res = await pool.query<PublishedRow & { is_alias: boolean }>(
				`SELECT ${PUBLISHED_COLUMNS(params.includeBody !== false, "cur")}, (matched.type = 'alias') AS is_alias
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses matched
				   ON matched.entry_id = e.id AND matched.collection = e.collection AND matched.locale = $3
				  AND matched.slug = $2 AND matched.type IN ('current', 'alias')
				 JOIN "${qSchema}".content_addresses cur
				   ON cur.entry_id = e.id AND cur.collection = e.collection AND cur.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE e.status = 'published' AND e.collection = $1
				 ORDER BY (matched.type = 'current') DESC
				 LIMIT 1`,
				[params.collection, params.slug, params.locale ?? DEFAULT_LOCALE],
			);

			const row = res.rows[0];
			if (!row) return { status: "not_found" };

			return {
				status: row.is_alias ? "alias" : "current",
				entry: mapPublishedRow(row),
			};
		},

		/**
		 * One page of published entries for a collection and language (relation filters, sorting, and pagination done in the DB). Relation filters accept relation fields only.
		 * A translation's shared relation values are read from the source's published version (from this language's body for per-language fields).
		 */
		listPublishedPage: async (
			params: PublishedPageParams,
		): Promise<{ items: PublishedEntryRecord[]; total: number; page: number; pageSize: number }> => {
			if (typeof params?.collection !== "string" || !isCollection(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;
			if (!Number.isInteger(page) || page < 1) throw new CmsError("Invalid page", "invalid_input");
			if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
				throw new CmsError("Invalid pageSize", "invalid_input");
			}
			const sort = params.sort ?? "publishedAt";
			if (!(sort in SORT_COLUMNS)) throw new CmsError("Invalid sort", "invalid_input");
			const order = params.order === "asc" ? "ASC" : "DESC";

			const values: unknown[] = [params.collection, params.locale ?? DEFAULT_LOCALE];
			const bind = (value: unknown) => {
				values.push(value);
				return `$${values.length}`;
			};
			const conditions = ["e.status = 'published'", "e.collection = $1", "e.locale = $2"];
			for (const [field, raw] of Object.entries(params.where ?? {})) {
				const stored = isCollection(params.collection) ? storedField(params.collection, field) : undefined;
				if (stored?.field.kind !== "relation") throw new CmsError(`Invalid where field ${field}`, "invalid_input");
				const ids = (typeof raw === "string" ? [raw] : [...raw]).filter((id) => typeof id === "string");
				if (ids.length === 0) continue;
				const metadata = stored.field.localized ? "b.metadata" : "sb.metadata";
				conditions.push(
					stored.field.many
						? `COALESCE(${metadata}->${bind(field)}, '[]'::jsonb) ?| ${bind(ids)}::text[]`
						: `${metadata}->>${bind(field)} = ANY(${bind(ids)}::text[])`,
				);
			}

			const from = `FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE ${conditions.join(" AND ")}`;
			const total = Number(
				(await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count ${from}`, values)).rows[0]?.count ?? 0,
			);
			// Values not used by the count query are appended separately (Postgres errors on unused placeholders because it cannot infer their type).
			const rowValues = [...values];
			let orderBy = SORT_COLUMNS[sort];
			if (
				sort === "title" &&
				isCollection(params.collection) &&
				recordLocalizedFields(params.collection).includes("title")
			) {
				rowValues.push(params.titleLocale ?? params.locale ?? DEFAULT_LOCALE);
				orderBy = `COALESCE(NULLIF(btrim(b.metadata->'${RECORD_TRANSLATIONS_KEY}'->$${rowValues.length}::text->>'title'), ''), b.metadata->>'title')`;
			}
			const rows = await pool.query<PublishedRow>(
				`SELECT ${PUBLISHED_COLUMNS(params.includeBody === true)} ${from}
				 ORDER BY ${orderBy} ${order} NULLS LAST, e.id ASC
				 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
				rowValues,
			);
			return { items: rows.rows.map(mapPublishedRow), total, page, pageSize };
		},

		/** Published languages of a translation group (including the source). Empty if the source is not published. */
		listPublishedTranslations: async (params: {
			translationGroupId: string;
		}): Promise<{ id: string; collection: string; locale: string; slug: string }[]> => {
			const res = await pool.query<{ id: string; collection: string; locale: string; slug: string }>(
				`SELECT e.id, e.collection, e.locale, a.slug
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entries src ON src.id = COALESCE(e.translation_group_id, e.id) AND src.status = 'published'
				 WHERE e.status = 'published' AND COALESCE(e.translation_group_id, e.id) = $1
				 ORDER BY (e.translation_group_id IS NULL) DESC, e.locale`,
				[params.translationGroupId],
			);
			return res.rows;
		},

		/**
		 * Published versions (all languages) for translation group IDs. Used when resolving relations: the caller picks the language and falls back to the source.
		 * Targets that are not published are omitted.
		 */
		listPublishedByGroups: async (params: {
			translationGroupIds: readonly string[];
		}): Promise<PublishedEntryRecord[]> => {
			const ids = params.translationGroupIds.filter((id) => typeof id === "string");
			if (ids.length === 0) return [];
			const res = await pool.query<PublishedRow>(
				`SELECT ${PUBLISHED_COLUMNS(false)}
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE e.status = 'published' AND COALESCE(e.translation_group_id, e.id) = ANY($1::uuid[])`,
				[ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id))],
			);
			return res.rows.map(mapPublishedRow);
		},
	};
}

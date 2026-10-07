import { sql } from "kysely";
import { CmsError } from "../../../core/store/errors";
import type { EntryMetadata, PublishedEntryLookup, PublishedEntryRecord } from "../../../core/store/types";
import type { Site } from "../../../site";
import type { Db } from "../db/kysely";
import type { StoreContext } from "./context";
import { mapPublishedEntryRow } from "./rows";
import { titleExpr, translatedTitleExpr } from "./title-sql";

function assertPublicCollections(site: Site, collections: readonly string[]): void {
	if (!Array.isArray(collections) || collections.length === 0) {
		throw new CmsError("Invalid collections", "invalid_input");
	}
	for (const collection of collections) {
		if (typeof collection !== "string" || !site.isCollection(collection)) {
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

/** The group an entry belongs to: its source, or itself for a source. */
const groupOf = sql<string>`coalesce(e.translation_group_id, e.id)`;

/**
 * Entries with a current address and a published body, read together with their source's published version: a translation is in the public layer only
 * while its source is published. For a source, `src` is itself.
 */
const publishedFrom = (db: Db) =>
	db
		.selectFrom("entries as e")
		.innerJoin("content_addresses as a", (join) =>
			join.onRef("a.entry_id", "=", "e.id").onRef("a.collection", "=", "e.collection").on("a.type", "=", "current"),
		)
		.innerJoin("entry_bodies as b", (join) => join.onRef("b.entry_id", "=", "e.id").on("b.state", "=", "published"))
		.innerJoin("entries as src", (join) => join.on("src.id", "=", groupOf).on("src.status", "=", "published"))
		.innerJoin("entry_bodies as sb", (join) =>
			join.onRef("sb.entry_id", "=", "src.id").on("sb.state", "=", "published"),
		);

type PublishedFrom = ReturnType<typeof publishedFrom>;

/** The publish date is the source's (a translation uses the source date too). The modified date is that of this language's body. */
const selectPublished = (from: PublishedFrom, withBody: boolean) =>
	from.select([
		"e.id",
		"e.collection",
		"e.locale",
		sql<string>`coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
		"a.slug",
		"b.metadata",
		"sb.metadata as source_metadata",
		(withBody ? sql.ref<unknown>("b.doc") : sql<unknown>`null::jsonb`).as("doc"),
		"src.published_at",
		"b.updated_at as body_updated_at",
	]);

/** Translation metadata = the source's shared values + the translation's per-language values. */
function mapPublishedRow(site: Site, row: PublishedRow): PublishedEntryRecord {
	const isTranslation = row.translation_group_id !== row.id;
	const metadata =
		isTranslation && site.isCollection(row.collection)
			? (site.mergeTranslationMetadata(row.collection, row.source_metadata, row.metadata) as EntryMetadata)
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

/** The columns of the sorts that do not read a field. The title sort reads the collection's title field (`titleExpr`). */
const SORT_COLUMNS: Record<Exclude<PublishedSort, "title">, string> = {
	publishedAt: "src.published_at",
	updatedAt: "b.updated_at",
};

/**
 * Public reads only. Public pages, RSS, sitemap, and OG call it on every request.
 * It requires both a published body and published status, so drafts, archived, and trashed entries are never returned by any path.
 */
export function createPublicReadOps(ctx: StoreContext) {
	const { site } = ctx;
	const db = ctx.db();
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
			assertPublicCollections(site, params.collections);
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}
			if (params.locale !== undefined && typeof params.locale !== "string") {
				throw new CmsError("Invalid locale", "invalid_input");
			}

			const { locale } = params;
			const rows = await selectPublished(publishedFrom(db), params.includeBody === true)
				.where("e.status", "=", "published")
				.where("e.collection", "=", sql<string>`any(${[...params.collections]}::text[])`)
				.$if(locale !== undefined, (qb) => qb.where("e.locale", "=", locale as string))
				.orderBy("b.updated_at", "desc")
				.orderBy("e.id", "asc")
				.execute();

			return rows.map((row) => mapPublishedRow(site, row));
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
			if (typeof params.collection !== "string" || !site.isCollection(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			if (typeof params.slug !== "string" || params.slug.length === 0) {
				throw new CmsError("Invalid slug", "invalid_input");
			}
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}

			// `a` is the current address of the entry, `matched` the address the request named (the current one or a former one).
			const row = await selectPublished(publishedFrom(db), params.includeBody !== false)
				.innerJoin("content_addresses as matched", (join) =>
					join
						.onRef("matched.entry_id", "=", "e.id")
						.onRef("matched.collection", "=", "e.collection")
						.on("matched.locale", "=", params.locale ?? site.DEFAULT_LOCALE)
						.on("matched.slug", "=", params.slug)
						.on("matched.type", "in", ["current", "alias"]),
				)
				.select((eb) => eb("matched.type", "=", "alias").as("is_alias"))
				.where("e.status", "=", "published")
				.where("e.collection", "=", params.collection)
				.orderBy((eb) => eb("matched.type", "=", "current"), "desc")
				.limit(1)
				.executeTakeFirst();

			if (!row) return { status: "not_found" };

			return {
				status: row.is_alias ? "alias" : "current",
				entry: mapPublishedRow(site, row),
			};
		},

		/**
		 * One page of published entries for a collection and language (relation filters, sorting, and pagination done in the DB). Relation filters accept relation fields only.
		 * A translation's shared relation values are read from the source's published version (from this language's body for per-language fields).
		 */
		listPublishedPage: async (
			params: PublishedPageParams,
		): Promise<{ items: PublishedEntryRecord[]; total: number; page: number; pageSize: number }> => {
			if (typeof params?.collection !== "string" || !site.isCollection(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;
			if (!Number.isInteger(page) || page < 1) throw new CmsError("Invalid page", "invalid_input");
			if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
				throw new CmsError("Invalid pageSize", "invalid_input");
			}
			const sort = params.sort ?? "publishedAt";
			if (sort !== "title" && !(sort in SORT_COLUMNS)) throw new CmsError("Invalid sort", "invalid_input");
			const descending = params.order !== "asc";

			let from = publishedFrom(db)
				.where("e.status", "=", "published")
				.where("e.collection", "=", params.collection)
				.where("e.locale", "=", params.locale ?? site.DEFAULT_LOCALE);
			for (const [field, raw] of Object.entries(params.where ?? {})) {
				const stored = site.isCollection(params.collection) ? site.storedField(params.collection, field) : undefined;
				if (stored?.field.kind !== "relation") throw new CmsError(`Invalid where field ${field}`, "invalid_input");
				const ids = (typeof raw === "string" ? [raw] : [...raw]).filter((id) => typeof id === "string");
				if (ids.length === 0) continue;
				const metadata = sql.ref(stored.field.localized ? "b.metadata" : "sb.metadata");
				from = from.where(
					stored.field.many
						? sql<boolean>`coalesce(${metadata}->${field}, '[]'::jsonb) ?| ${ids}::text[]`
						: sql<boolean>`${metadata}->>${field} = any(${ids}::text[])`,
				);
			}

			const count = await from.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst();
			const total = Number(count?.count ?? 0);
			const titleLocale = params.titleLocale ?? params.locale ?? site.DEFAULT_LOCALE;
			const sortBy =
				sort !== "title"
					? sql.ref(SORT_COLUMNS[sort])
					: site.recordLocalizedFields(params.collection).includes(site.titleField(params.collection).name)
						? translatedTitleExpr(site, "b.metadata", params.collection, titleLocale)
						: titleExpr(site, "b.metadata", { collection: params.collection });
			const rows = await selectPublished(from, params.includeBody === true)
				.orderBy(sortBy, (order) => (descending ? order.desc() : order.asc()).nullsLast())
				.orderBy("e.id", "asc")
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.execute();
			return { items: rows.map((row) => mapPublishedRow(site, row)), total, page, pageSize };
		},

		/** Published languages of a translation group (including the source). Empty if the source is not published. */
		listPublishedTranslations: async (params: {
			translationGroupId: string;
		}): Promise<{ id: string; collection: string; locale: string; slug: string }[]> =>
			db
				.selectFrom("entries as e")
				.innerJoin("content_addresses as a", (join) =>
					join.onRef("a.entry_id", "=", "e.id").onRef("a.collection", "=", "e.collection").on("a.type", "=", "current"),
				)
				.innerJoin("entries as src", (join) => join.on("src.id", "=", groupOf).on("src.status", "=", "published"))
				.select(["e.id", "e.collection", "e.locale", "a.slug"])
				.where("e.status", "=", "published")
				.where(groupOf, "=", params.translationGroupId)
				.orderBy((eb) => eb("e.translation_group_id", "is", null), "desc")
				.orderBy("e.locale")
				.execute(),

		/**
		 * Published versions (all languages) for translation group IDs. Used when resolving relations: the caller picks the language and falls back to the source.
		 * Targets that are not published are omitted.
		 */
		listPublishedByGroups: async (params: {
			translationGroupIds: readonly string[];
		}): Promise<PublishedEntryRecord[]> => {
			const ids = params.translationGroupIds.filter((id) => typeof id === "string");
			if (ids.length === 0) return [];
			const rows = await selectPublished(publishedFrom(db), false)
				.where("e.status", "=", "published")
				.where(groupOf, "=", sql<string>`any(${ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id))}::uuid[])`)
				.execute();
			return rows.map((row) => mapPublishedRow(site, row));
		},
	};
}

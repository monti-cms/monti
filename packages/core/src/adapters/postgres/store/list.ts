import { type Expression, type SqlBool, sql } from "kysely";
import { LIST_SORT_FIELDS, LIST_STATUSES, type ListStatus, PAGE_SIZES, TRANSLATION_FILTERS } from "../../../core/api";
import type { Collection } from "../../../core/collections";
import { isUuid } from "../../../core/ids";
import { CmsError } from "../../../core/store/errors";
import {
	type DateRange,
	DEFAULT_ENTRY_SEARCH_LIMIT,
	type EntrySearchHit,
	type FieldCondition,
	type ListCounts,
	type ListCountsParams,
	type ListEntriesItem,
	type ListEntriesParams,
	type ListEntriesResult,
	type ListTranslationMember,
	MAX_ENTRY_SEARCH_LIMIT,
	type SearchEntriesParams,
} from "../../../core/store/types";
import { RECORD_TRANSLATIONS_KEY } from "../../../schema/fields";
import type { StoredField } from "../../../schema/walk";
import type { Site } from "../../../site";
import type { StoreContext } from "./context";
import { likeContainsPattern, likePrefixPattern, likeWordPattern } from "./sql";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/**
 * Languages that have a value in the entry. A language exists if any per-language text field (`localized: true`) has a value. The default language is the field itself,
 * other languages are `translations[locale][field]`.
 */
function namedLocales(site: Site, collection: Collection, metadata: Record<string, unknown>): string[] {
	const fields = site.recordLocalizedFields(collection);
	const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {}) as Record<string, Record<string, unknown> | undefined>;
	const hasValue = (value: unknown) => typeof value === "string" && value.trim() !== "";
	return site.LOCALES.filter((locale) =>
		fields.some((field) => hasValue(locale === site.DEFAULT_LOCALE ? metadata[field] : translations[locale]?.[field])),
	);
}

const isDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());

/** Stored fields a list can filter and count on, with the conditions each kind takes. */
const FILTER_KINDS = {
	text: ["empty", "filled"],
	media: ["empty", "filled"],
	select: ["empty", "is"],
	relation: ["empty", "is"],
} as const;

const filterFieldOf = (site: Site, collection: string, name: string): StoredField | undefined =>
	site
		.storedFields(collection as Collection)
		.find((stored) => stored.name === name && Object.hasOwn(FILTER_KINDS, stored.field.kind));

/** Relation fields of a collection. Used by the row's `relations`. */
const relationFieldsOf = (site: Site, collection: string): StoredField[] =>
	site.storedFields(collection as Collection).filter((stored) => stored.field.kind === "relation");

/** Fields shown as text in list cells (relations are carried separately in `relations`). */
const valueColumnFieldsOf = (site: Site, collection: string): StoredField[] =>
	site
		.storedFields(collection as Collection)
		.filter((stored) => ["text", "select", "media"].includes(stored.field.kind));

/** Draft to read relation values from. A non-per-language value is shared across the translation group, so it is read from the source draft (`sw`). */
const relationSource = (stored: StoredField): "w" | "sw" => (stored.field.localized ? "w" : "sw");

/** The stored value of a field in the row, as jsonb: its own draft for a per-language field (which may inherit the source's), else the source's draft. */
const storedValue = (stored: StoredField) =>
	stored.field.localized === "inherit"
		? sql`coalesce(${sql.ref("w.metadata")}->${stored.name}, ${sql.ref("sw.metadata")}->${stored.name})`
		: sql`${sql.ref(`${relationSource(stored)}.metadata`)}->${stored.name}`;

/** A field with no value: missing, null, an empty text or an empty list. */
const isEmptyValue = (stored: StoredField) =>
	sql<boolean>`coalesce(${storedValue(stored)}, 'null'::jsonb) in ('null'::jsonb, '""'::jsonb, '[]'::jsonb)`;

/** One condition on a field. */
const fieldCondition = (stored: StoredField, condition: FieldCondition) => {
	if (condition.kind === "empty") return isEmptyValue(stored);
	if (condition.kind === "filled") return sql<boolean>`not ${isEmptyValue(stored)}`;
	return stored.field.kind === "relation" && stored.field.many
		? sql<boolean>`coalesce(${storedValue(stored)}, '[]'::jsonb) ?| array[${condition.value}]::text[]`
		: sql<boolean>`(${storedValue(stored)}) #>> '{}' = ${condition.value}`;
};

const relationIds = (value: unknown): string[] =>
	typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

function assertParams(site: Site, params: ListEntriesParams) {
	if (typeof params !== "object" || params === null || Array.isArray(params)) {
		throw new CmsError("Invalid parameters", "invalid_input");
	}
	if (!(site.COLLECTIONS as readonly string[]).includes(params.collection)) {
		throw new CmsError("Invalid collection", "invalid_input");
	}
	for (const key of ["search"] as const) {
		if (params[key] !== undefined && typeof params[key] !== "string")
			throw new CmsError(`Invalid ${key}`, "invalid_input");
	}
	for (const key of ["includeBody", "includeDescendants", "groupTranslations"] as const) {
		if (params[key] !== undefined && typeof params[key] !== "boolean")
			throw new CmsError(`Invalid ${key}`, "invalid_input");
	}
	if (params.statuses !== undefined) {
		if (!Array.isArray(params.statuses) || params.statuses.some((s) => !LIST_STATUSES.includes(s))) {
			throw new CmsError("Invalid status", "invalid_input");
		}
	}
	if (
		params.locales !== undefined &&
		(!Array.isArray(params.locales) || params.locales.some((l) => !site.isLocale(l)))
	) {
		throw new CmsError("Invalid locale", "invalid_input");
	}
	if (params.fields !== undefined) assertFieldConditions(site, params.collection, params.fields);
	if (params.translations !== undefined) {
		if (
			!Array.isArray(params.translations) ||
			params.translations.some((filter) => !TRANSLATION_FILTERS.includes(filter))
		) {
			throw new CmsError("Invalid translations", "invalid_input");
		}
		if (site.isItemCollection(params.collection)) {
			throw new CmsError("A collection without translations has no translation filter", "invalid_input");
		}
	}
	if (params.folderId !== undefined && params.folderId !== null && !isUuid(params.folderId)) {
		throw new CmsError("Invalid folderId", "invalid_input");
	}
	for (const key of ["createdAt", "updatedAt", "publishedAt"] as const) {
		const range = params[key];
		if (range === undefined) continue;
		if ((range.from !== undefined && !isDate(range.from)) || (range.to !== undefined && !isDate(range.to))) {
			throw new CmsError(`Invalid ${key} range`, "invalid_input");
		}
	}
	if (params.sort !== undefined) {
		if (!LIST_SORT_FIELDS.includes(params.sort?.field) || !["asc", "desc"].includes(params.sort?.direction)) {
			throw new CmsError("Invalid sort", "invalid_input");
		}
	}
	if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1)) {
		throw new CmsError("Invalid page", "invalid_input");
	}
	if (params.pageSize !== undefined && !PAGE_SIZES.includes(params.pageSize)) {
		throw new CmsError("Invalid pageSize", "invalid_input");
	}
}

/** Each condition must be on a stored field of the collection and one its kind takes: an option of the select, the id of an item of the relation. */
function assertFieldConditions(site: Site, collection: string, fields: NonNullable<ListEntriesParams["fields"]>) {
	if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
		throw new CmsError("Invalid fields", "invalid_input");
	}
	for (const [name, conditions] of Object.entries(fields)) {
		const stored = filterFieldOf(site, collection, name);
		if (!stored) throw new CmsError(`No field to filter by: ${name}`, "invalid_input");
		if (!Array.isArray(conditions)) throw new CmsError(`Invalid ${name} filter`, "invalid_input");
		const taken: readonly string[] = FILTER_KINDS[stored.field.kind as keyof typeof FILTER_KINDS];
		for (const condition of conditions) {
			if (!taken.includes(condition?.kind)) throw new CmsError(`${name} cannot be filtered so`, "invalid_input");
			if (condition.kind !== "is") continue;
			const valid =
				stored.field.kind === "relation"
					? typeof condition.value === "string" && isUuid(condition.value)
					: stored.field.kind === "select"
						? typeof condition.value === "string" && Object.hasOwn(stored.field.options, condition.value)
						: false;
			if (!valid) throw new CmsError(`Invalid ${name} filter`, "invalid_input");
		}
	}
}

function assertSearchParams(site: Site, params: SearchEntriesParams) {
	if (typeof params !== "object" || params === null || Array.isArray(params)) {
		throw new CmsError("Invalid parameters", "invalid_input");
	}
	if (!(site.COLLECTIONS as readonly string[]).includes(params.collection)) {
		throw new CmsError("Invalid collection", "invalid_input");
	}
	if (params.query !== undefined && typeof params.query !== "string")
		throw new CmsError("Invalid query", "invalid_input");
	if (params.publishedOnly !== undefined && typeof params.publishedOnly !== "boolean") {
		throw new CmsError("Invalid publishedOnly", "invalid_input");
	}
	if (params.locale !== undefined && !site.isLocale(params.locale))
		throw new CmsError("Invalid locale", "invalid_input");
	if (
		params.limit !== undefined &&
		(!Number.isInteger(params.limit) || params.limit < 1 || params.limit > MAX_ENTRY_SEARCH_LIMIT)
	) {
		throw new CmsError("Invalid limit", "invalid_input");
	}
	if (params.ids !== undefined && (!Array.isArray(params.ids) || params.ids.some((id) => !isUuid(id)))) {
		throw new CmsError("Invalid ids", "invalid_input");
	}
}

/** Whether the working body differs from the published one, or the working slug from the current address. `entry` is the alias of the entries table. */
const hasChanges = (entry: "e" | "m") =>
	sql<boolean>`(p.entry_id is not null and (p.content_hash <> w.content_hash or ${sql.ref(`${entry}.working_slug`)} is distinct from cur.slug))`;

/** Whether the row is in one of the states a list can filter by. `published` has no unpublished changes, `editing` has. */
const inState = (status: ListStatus) =>
	status === "published"
		? sql<boolean>`(e.status = 'published' and not ${hasChanges("e")})`
		: status === "editing"
			? sql<boolean>`(e.status = 'published' and ${hasChanges("e")})`
			: sql<boolean>`e.status = ${status}`;

/** The group an entry belongs to: its source, or itself for a source. */
const groupOf = (entry: "e" | "m") =>
	sql<string>`coalesce(${sql.ref(`${entry}.translation_group_id`)}, ${sql.ref(`${entry}.id`)})`;

/** Admin list. Search, filtering, sorting, and paging are handled on the server. */
export function createListOps(ctx: StoreContext) {
	const { qSchema, site } = ctx;
	const db = ctx.db();

	/**
	 * Whether the row's translation group has a translation confirmed against an earlier source than the source now is. The stored hashes of the two
	 * documents (`documentKeyHash`, the hash of the key `sourceHasChanged` compares) are compared in SQL, so no document is read.
	 */
	const behindGroup = sql<boolean>`exists (
		select 1 from ${sql.id(qSchema, "entries")} t
		join ${sql.id(qSchema, "entry_bodies")} tw on tw.entry_id = t.id and tw.state = 'working'
		join ${sql.id(qSchema, "entry_bodies")} sw2 on sw2.entry_id = ${groupOf("e")} and sw2.state = 'working'
		where t.translation_group_id = ${groupOf("e")} and t.id <> ${groupOf("e")} and t.status <> 'trashed'
			and tw.translation_base_hash is distinct from sw2.doc_key_hash
	)`;

	/** Whether the row's translation group has a translation outside the trash. */
	const translatedGroup = sql<boolean>`exists (
			select 1 from ${sql.id(qSchema, "entries")} t
			where t.translation_group_id = ${groupOf("e")} and t.id <> ${groupOf("e")} and t.status <> 'trashed'
		)`;

	/** The rows of a list before sorting and paging: the collection, the folder, the statuses and every filter. */
	const buildFrom = (params: ListEntriesParams) => {
		const grouped = params.groupTranslations === true;
		const titleOf = (alias: string) => titleExpr(site, `${alias}.metadata`, { collection: params.collection });

		/** Whether content in the same group that is outside the trash (including the source) satisfies the condition. */
		const anyMember = (predicate: Expression<SqlBool>) =>
			sql<boolean>`exists (
					select 1 from ${sql.id(qSchema, "entries")} m
					join ${sql.id(qSchema, "entry_bodies")} mw on mw.entry_id = m.id and mw.state = 'working'
					where ${groupOf("m")} = e.id and m.status <> 'trashed' and ${predicate}
				)`;

		const from = db
			.selectFrom("entries as e")
			.innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
			.innerJoin("entry_bodies as sw", (join) =>
				join.on("sw.entry_id", "=", groupOf("e")).on("sw.state", "=", "working"),
			)
			.leftJoin("entry_bodies as p", (join) => join.onRef("p.entry_id", "=", "e.id").on("p.state", "=", "published"))
			.leftJoin("content_addresses as cur", (join) =>
				join.onRef("cur.entry_id", "=", "e.id").on("cur.type", "=", "current"),
			)
			.where((eb) => {
				const conditions: Expression<SqlBool>[] = [eb("e.collection", "=", params.collection)];
				// Group view keeps only the source as a row. Translations come attached in the row's `translations`.
				if (grouped) {
					conditions.push(
						eb.or([eb("e.translation_group_id", "is", null), eb("e.translation_group_id", "=", eb.ref("e.id"))]),
					);
				}
				if (params.statuses && params.statuses.length > 0) {
					conditions.push(eb.or(params.statuses.map(inState)));
				} else {
					// The default list hides the trash.
					conditions.push(eb("e.status", "<>", "trashed"));
				}

				if (params.folderId === null) {
					conditions.push(eb("e.folder_id", "is", null));
				} else if (params.folderId !== undefined) {
					conditions.push(
						params.includeDescendants
							? sql<boolean>`e.folder_id in (
									with recursive descendants as (
										select id from ${sql.id(qSchema, "folders")} where id = ${params.folderId}
										union all
										select f.id from ${sql.id(qSchema, "folders")} f join descendants d on f.parent_id = d.id
									)
									select id from descendants
								)`
							: eb("e.folder_id", "=", params.folderId),
					);
				}

				// Word by word: every word of the search must be found (in the title, the slug or, with `includeBody`, the body), in any order. A word may
				// be found in a different place than the others, and in a grouped list in a different language of the group.
				for (const word of params.search?.split(/\s+/).filter(Boolean) ?? []) {
					const token = likeContainsPattern(word);
					const matches = (alias: "w" | "mw", slug: "e.working_slug" | "m.working_slug") =>
						sql<boolean>`(${sql.ref(slug)} ilike ${token} or ${titleOf(alias)} ilike ${token}${
							params.includeBody ? sql` or ${sql.ref(`${alias}.search_text`)} ilike ${token}` : sql``
						})`;
					conditions.push(
						grouped
							? sql<boolean>`(${matches("w", "e.working_slug")} or ${anyMember(matches("mw", "m.working_slug"))})`
							: matches("w", "e.working_slug"),
					);
				}
				if (params.locales && params.locales.length > 0) {
					const locales = sql<string>`any(${params.locales}::text[])`;
					conditions.push(grouped ? anyMember(sql<boolean>`m.locale = ${locales}`) : eb("e.locale", "=", locales));
				}
				// A value shared across a translation group is read from the source draft's values even for a translation. For a source, `sw` is its own draft.
				for (const [name, conditions_] of Object.entries(params.fields ?? {})) {
					const stored = filterFieldOf(site, params.collection, name);
					if (!stored || conditions_.length === 0) continue;
					conditions.push(eb.or(conditions_.map((condition) => fieldCondition(stored, condition))));
				}
				if (params.translations && params.translations.length > 0) {
					const hasTranslations = translatedGroup;
					const states: Record<(typeof TRANSLATION_FILTERS)[number], Expression<SqlBool>> = {
						none: sql<boolean>`not ${hasTranslations}`,
						changed: behindGroup,
						current: sql<boolean>`(${hasTranslations} and not ${behindGroup})`,
					};
					conditions.push(eb.or(params.translations.map((filter) => states[filter])));
				}
				const addRange = (column: "e.created_at" | "e.updated_at" | "e.published_at", range: DateRange | undefined) => {
					if (range?.from) conditions.push(eb(column, ">=", range.from));
					if (range?.to) conditions.push(eb(column, "<=", range.to));
				};
				addRange("e.created_at", params.createdAt);
				addRange("e.updated_at", params.updatedAt);
				addRange("e.published_at", params.publishedAt);
				return eb.and(conditions);
			});

		return { from, grouped, titleOf, anyMember };
	};

	return {
		searchEntries: async (params: SearchEntriesParams): Promise<EntrySearchHit[]> => {
			assertSearchParams(site, params);
			let found = db
				.selectFrom("entries as e")
				.innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
				.select([
					"e.id",
					"e.working_slug",
					"e.status",
					sql<
						string | null
					>`coalesce(nullif(${titleExpr(site, "w.metadata", { collection: params.collection })}, ''), nullif(e.working_slug, ''))`.as(
						"title",
					),
				])
				.where("e.collection", "=", params.collection)
				.where("e.status", "<>", "trashed");
			let rank = sql<number | null>`0`;
			let limit = DEFAULT_ENTRY_SEARCH_LIMIT;
			if (params.ids !== undefined) {
				if (params.ids.length === 0) return [];
				found = found.where("e.id", "=", sql<string>`any(${params.ids}::uuid[])`);
				limit = params.ids.length;
			} else {
				limit = params.limit ?? DEFAULT_ENTRY_SEARCH_LIMIT;
				if (params.publishedOnly) found = found.where("e.status", "=", "published");
				if (params.locale !== undefined) found = found.where("e.locale", "=", params.locale);
				const query = params.query?.trim();
				if (query) {
					const contains = likeContainsPattern(query);
					rank = sql<number | null>`case
						when lower(title) = lower(${query}) then 0
						when title ilike ${likePrefixPattern(query)} then 1
						when title ilike ${likeWordPattern(query)} then 2
						when title ilike ${contains} then 3
						when working_slug ilike ${contains} then 4
					end`;
				}
			}
			const rows = await db
				.selectFrom(found.as("found"))
				.crossJoinLateral(db.selectNoFrom(rank.as("rank")).as("ranked"))
				.select(["found.id", "found.title", "found.working_slug", "found.status"])
				.where("ranked.rank", "is not", null)
				.orderBy("ranked.rank")
				.orderBy(sql`lower(found.title)`, (order) => order.asc().nullsLast())
				.orderBy("found.id")
				.limit(limit)
				.execute();
			return rows.map((row) => ({ id: row.id, title: row.title, slug: row.working_slug, status: row.status }));
		},

		countListValues: async (params: ListCountsParams): Promise<ListCounts> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			if (!(site.COLLECTIONS as readonly string[]).includes(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			const scope: ListEntriesParams = {
				collection: params.collection,
				groupTranslations: params.groupTranslations,
				folderId: params.folderId,
				includeDescendants: params.includeDescendants,
			};
			// The same checks as a list that carries these conditions: the folder must be valid.
			assertParams(site, scope);
			const { from } = buildFrom(scope);
			const count = async (extra?: Expression<SqlBool>) => {
				const rows = extra ? from.where(extra) : from;
				const row = await rows.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst();
				return Number(row?.count ?? 0);
			};
			const total = await count();
			if (params.facet === "status") {
				const values: Record<string, number> = {};
				for (const status of ["published", "editing", "draft", "archived"] as const)
					values[status] = await count(inState(status));
				return { total, values };
			}
			if (params.facet === "translation") {
				if (site.isItemCollection(params.collection)) {
					throw new CmsError("A collection without translations has no translation filter", "invalid_input");
				}
				const withTranslations = await count(translatedGroup);
				const changed = await count(behindGroup);
				return { total, values: { none: total - withTranslations, changed, current: withTranslations - changed } };
			}
			const stored = filterFieldOf(site, params.collection, params.facet.field);
			if (!stored) throw new CmsError(`No field to count: ${params.facet.field}`, "invalid_input");
			const empty = await count(isEmptyValue(stored));
			if (stored.field.kind === "text" || stored.field.kind === "media") {
				return { total, empty, filled: total - empty, values: {} };
			}
			const many = stored.field.kind === "relation" && stored.field.many === true;
			const valued = from.select(storedValue(stored).as("v"));
			const rows = many
				? await sql<{ value: string; n: string }>`
					select e.value, count(*) as n
					from (${valued}) r
					cross join lateral jsonb_array_elements_text(case when jsonb_typeof(r.v) = 'array' then r.v else '[]'::jsonb end) as e(value)
					group by e.value`.execute(db)
				: await sql<{ value: string; n: string }>`
					select r.v #>> '{}' as value, count(*) as n
					from (${valued}) r
					where r.v is not null and r.v not in ('null'::jsonb, '""'::jsonb)
					group by 1`.execute(db);
			return { total, empty, values: Object.fromEntries(rows.rows.map((row) => [row.value, Number(row.n)])) };
		},

		listEntries: async (params: ListEntriesParams): Promise<ListEntriesResult> => {
			assertParams(site, params);
			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;
			const { from, grouped, titleOf } = buildFrom(params);

			const sortColumns: Record<(typeof LIST_SORT_FIELDS)[number], Expression<unknown>> = {
				updatedAt: sql.ref("e.updated_at"),
				createdAt: sql.ref("e.created_at"),
				publishedAt: sql.ref("e.published_at"),
				trashedAt: sql.ref("e.trashed_at"),
				title: titleOf("w"),
				slug: sql.ref("e.working_slug"),
			};
			const sortColumn = sortColumns[params.sort?.field ?? "updatedAt"];
			const ascending = params.sort?.direction === "asc";

			const count = await from.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst();
			const total = Number(count?.count ?? 0);

			const dataRows = await from
				.select([
					"e.id",
					"e.collection",
					"e.locale",
					sql<string>`coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
					"e.status",
					"e.version",
					"e.folder_id",
					"e.created_at",
					"e.updated_at",
					"e.published_at",
					"e.trashed_at",
					"e.working_slug",
					"w.metadata",
					"sw.metadata as source_metadata",
					hasChanges("e").as("has_changes"),
				])
				.orderBy(sortColumn, (order) => (ascending ? order.asc() : order.desc()).nullsLast())
				.orderBy("e.id", "asc")
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.execute();

			const relationFields = relationFieldsOf(site, params.collection);
			const baseItems = dataRows.map((row) => {
				const meta = row.metadata ?? {};
				// Shared relation values are read from the source draft.
				const common = row.source_metadata ?? meta;
				const relationIdsByField = Object.fromEntries(
					relationFields.map((stored) => [
						stored.name,
						relationIds((relationSource(stored) === "w" ? meta : common)[stored.name]),
					]),
				);
				const values = Object.fromEntries(
					valueColumnFieldsOf(site, row.collection).flatMap((stored) => {
						const { localized } = stored.field;
						const value = localized
							? (meta[stored.name] ?? (localized === "inherit" ? common[stored.name] : undefined))
							: common[stored.name];
						return typeof value === "string" && value !== "" ? [[stored.name, value]] : [];
					}),
				);
				return {
					id: row.id,
					collection: row.collection,
					locale: row.locale,
					translationGroupId: row.translation_group_id,
					title: site.titleOfValues(row.collection, meta),
					slug: row.working_slug,
					status: row.status,
					version: row.version,
					folderId: row.folder_id,
					relationIdsByField,
					values,
					hasUnpublishedChanges: row.has_changes,
					publishedAt: row.published_at,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
					trashedAt: row.trashed_at,
					...(site.isItemCollection(row.collection)
						? { recordLocales: namedLocales(site, row.collection as Collection, meta) }
						: {}),
				};
			});

			const relatedIds = [
				...new Set(baseItems.flatMap((item) => Object.values(item.relationIdsByField).flat())),
			].filter(isUuid);
			const titleById = new Map<string, string>();
			if (relatedIds.length > 0) {
				const rows = await db
					.selectFrom("entries as e")
					.leftJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
					.leftJoin("entry_bodies as p", (join) =>
						join.onRef("p.entry_id", "=", "e.id").on("p.state", "=", "published"),
					)
					.select([
						sql<string>`e.id::text`.as("id"),
						sql<
							string | null
						>`coalesce(nullif(${titleExpr(site, "w.metadata", ROW_COLLECTION)}, ''), nullif(${titleExpr(site, "p.metadata", ROW_COLLECTION)}, ''), e.working_slug)`.as(
							"title",
						),
					])
					.where(sql<boolean>`e.id::text = any(${relatedIds}::text[])`)
					.execute();
				for (const row of rows) if (row.title) titleById.set(row.id, row.title);
			}

			const items: ListEntriesItem[] = baseItems.map(({ relationIdsByField, ...item }) => ({
				...item,
				relations: Object.fromEntries(
					Object.entries(relationIdsByField).map(([field, ids]) => [
						field,
						ids.map((id) => ({ id, title: titleById.get(id.toLowerCase()) ?? null })),
					]),
				),
			}));

			if (!grouped || items.length === 0) return { items, total, page, pageSize };

			const memberRows = await db
				.selectFrom("entries as m")
				.innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "m.id").on("w.state", "=", "working"))
				.leftJoin("entry_bodies as p", (join) => join.onRef("p.entry_id", "=", "m.id").on("p.state", "=", "published"))
				.leftJoin("content_addresses as cur", (join) =>
					join.onRef("cur.entry_id", "=", "m.id").on("cur.type", "=", "current"),
				)
				.select([
					"m.id",
					sql<string>`coalesce(m.translation_group_id, m.id)`.as("group_id"),
					"m.locale",
					"m.status",
					"m.version",
					hasChanges("m").as("has_changes"),
				])
				.where(groupOf("m"), "=", sql<string>`any(${items.map((item) => item.id)}::uuid[])`)
				.where("m.status", "<>", "trashed")
				.execute();
			const membersByGroup = new Map<string, ListTranslationMember[]>();
			for (const row of memberRows) {
				const members = membersByGroup.get(row.group_id) ?? [];
				members.push({
					id: row.id,
					locale: row.locale,
					status: row.status,
					version: row.version,
					isSource: row.id === row.group_id,
					hasUnpublishedChanges: row.has_changes,
				});
				membersByGroup.set(row.group_id, members);
			}
			const localeOrder = (locale: string) => {
				const index = (site.LOCALES as readonly string[]).indexOf(locale);
				return index === -1 ? site.LOCALES.length : index;
			};
			return {
				items: items.map((item) => ({
					...item,
					translations: (membersByGroup.get(item.id) ?? []).sort(
						(a, b) => localeOrder(a.locale) - localeOrder(b.locale),
					),
				})),
				total,
				page,
				pageSize,
			};
		},
	};
}

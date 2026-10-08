import { sql } from "kysely";
import { ENTRY_STATUSES, LIST_SORT_FIELDS, PAGE_SIZES } from "../../../core/api.js";
import { isUuid } from "../../../core/ids.js";
import { CmsError } from "../../../core/store/errors.js";
import { DEFAULT_ENTRY_SEARCH_LIMIT, MAX_ENTRY_SEARCH_LIMIT, } from "../../../core/store/types.js";
import { RECORD_TRANSLATIONS_KEY } from "../../../schema/derive.js";
import { likeContainsPattern, likePrefixPattern, likeWordPattern } from "./sql.js";
import { ROW_COLLECTION, titleExpr } from "./title-sql.js";
/**
 * Languages that have a value in the entry. A language exists if any per-language text field (`localized: true`) has a value. The default language is the field itself,
 * other languages are `translations[locale][field]`.
 */
function namedLocales(site, collection, metadata) {
    const fields = site.recordLocalizedFields(collection);
    const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {});
    const hasValue = (value) => typeof value === "string" && value.trim() !== "";
    return site.LOCALES.filter((locale) => fields.some((field) => hasValue(locale === site.DEFAULT_LOCALE ? metadata[field] : translations[locale]?.[field])));
}
const isDate = (value) => value instanceof Date && Number.isFinite(value.getTime());
/** Relation fields of a collection. Used by list filters and the row's `relations`. */
const relationFieldsOf = (site, collection) => site.storedFields(collection).filter((stored) => stored.field.kind === "relation");
/** Fields shown as text in list cells (relations are carried separately in `relations`). */
const valueColumnFieldsOf = (site, collection) => site
    .storedFields(collection)
    .filter((stored) => ["text", "select", "media"].includes(stored.field.kind));
/** Draft to read relation values from. A non-per-language value is shared across the translation group, so it is read from the source draft (`sw`). */
const relationSource = (stored) => (stored.field.localized ? "w" : "sw");
const relationIds = (value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
function assertParams(site, params) {
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
        throw new CmsError("Invalid parameters", "invalid_input");
    }
    if (!site.COLLECTIONS.includes(params.collection)) {
        throw new CmsError("Invalid collection", "invalid_input");
    }
    for (const key of ["search", "titleContains", "slugContains"]) {
        if (params[key] !== undefined && typeof params[key] !== "string")
            throw new CmsError(`Invalid ${key}`, "invalid_input");
    }
    for (const key of ["includeBody", "includeDescendants", "hasUnpublishedChanges", "groupTranslations"]) {
        if (params[key] !== undefined && typeof params[key] !== "boolean")
            throw new CmsError(`Invalid ${key}`, "invalid_input");
    }
    if (params.statuses !== undefined) {
        if (!Array.isArray(params.statuses) || params.statuses.some((s) => !ENTRY_STATUSES.includes(s))) {
            throw new CmsError("Invalid status", "invalid_input");
        }
    }
    if (params.locales !== undefined &&
        (!Array.isArray(params.locales) || params.locales.some((l) => !site.isLocale(l)))) {
        throw new CmsError("Invalid locale", "invalid_input");
    }
    if (params.relations !== undefined) {
        if (typeof params.relations !== "object" || params.relations === null || Array.isArray(params.relations)) {
            throw new CmsError("Invalid relations", "invalid_input");
        }
        const fields = new Set(relationFieldsOf(site, params.collection).map((stored) => stored.name));
        for (const [field, ids] of Object.entries(params.relations)) {
            if (!fields.has(field))
                throw new CmsError(`Unknown relation field: ${field}`, "invalid_input");
            if (!Array.isArray(ids) || ids.some((id) => !isUuid(id))) {
                throw new CmsError(`Invalid ${field} filter`, "invalid_input");
            }
        }
    }
    if (params.folderId !== undefined && params.folderId !== null && !isUuid(params.folderId)) {
        throw new CmsError("Invalid folderId", "invalid_input");
    }
    for (const key of ["createdAt", "updatedAt", "publishedAt"]) {
        const range = params[key];
        if (range === undefined)
            continue;
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
function assertSearchParams(site, params) {
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
        throw new CmsError("Invalid parameters", "invalid_input");
    }
    if (!site.COLLECTIONS.includes(params.collection)) {
        throw new CmsError("Invalid collection", "invalid_input");
    }
    if (params.query !== undefined && typeof params.query !== "string")
        throw new CmsError("Invalid query", "invalid_input");
    if (params.publishedOnly !== undefined && typeof params.publishedOnly !== "boolean") {
        throw new CmsError("Invalid publishedOnly", "invalid_input");
    }
    if (params.locale !== undefined && !site.isLocale(params.locale))
        throw new CmsError("Invalid locale", "invalid_input");
    if (params.limit !== undefined &&
        (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > MAX_ENTRY_SEARCH_LIMIT)) {
        throw new CmsError("Invalid limit", "invalid_input");
    }
    if (params.ids !== undefined && (!Array.isArray(params.ids) || params.ids.some((id) => !isUuid(id)))) {
        throw new CmsError("Invalid ids", "invalid_input");
    }
}
/** Whether the working body differs from the published one, or the working slug from the current address. `entry` is the alias of the entries table. */
const hasChanges = (entry) => sql `(p.entry_id is not null and (p.content_hash <> w.content_hash or ${sql.ref(`${entry}.working_slug`)} is distinct from cur.slug))`;
/** The group an entry belongs to: its source, or itself for a source. */
const groupOf = (entry) => sql `coalesce(${sql.ref(`${entry}.translation_group_id`)}, ${sql.ref(`${entry}.id`)})`;
/** Admin list. Search, filtering, sorting, and paging are handled on the server. */
export function createListOps(ctx) {
    const { qSchema, site } = ctx;
    const db = ctx.db();
    return {
        searchEntries: async (params) => {
            assertSearchParams(site, params);
            let found = db
                .selectFrom("entries as e")
                .innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
                .select([
                "e.id",
                "e.working_slug",
                "e.status",
                sql `coalesce(nullif(${titleExpr(site, "w.metadata", { collection: params.collection })}, ''), nullif(e.working_slug, ''))`.as("title"),
            ])
                .where("e.collection", "=", params.collection)
                .where("e.status", "<>", "trashed");
            let rank = sql `0`;
            let limit = DEFAULT_ENTRY_SEARCH_LIMIT;
            if (params.ids !== undefined) {
                if (params.ids.length === 0)
                    return [];
                found = found.where("e.id", "=", sql `any(${params.ids}::uuid[])`);
                limit = params.ids.length;
            }
            else {
                limit = params.limit ?? DEFAULT_ENTRY_SEARCH_LIMIT;
                if (params.publishedOnly)
                    found = found.where("e.status", "=", "published");
                if (params.locale !== undefined)
                    found = found.where("e.locale", "=", params.locale);
                const query = params.query?.trim();
                if (query) {
                    const contains = likeContainsPattern(query);
                    rank = sql `case
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
                .orderBy(sql `lower(found.title)`, (order) => order.asc().nullsLast())
                .orderBy("found.id")
                .limit(limit)
                .execute();
            return rows.map((row) => ({ id: row.id, title: row.title, slug: row.working_slug, status: row.status }));
        },
        listEntries: async (params) => {
            assertParams(site, params);
            const page = params.page ?? 1;
            const pageSize = params.pageSize ?? 25;
            const grouped = params.groupTranslations === true;
            const titleOf = (alias) => titleExpr(site, `${alias}.metadata`, { collection: params.collection });
            /** Whether content in the same group that is outside the trash (including the source) satisfies the condition. */
            const anyMember = (predicate) => sql `exists (
					select 1 from ${sql.id(qSchema, "entries")} m
					join ${sql.id(qSchema, "entry_bodies")} mw on mw.entry_id = m.id and mw.state = 'working'
					where ${groupOf("m")} = e.id and m.status <> 'trashed' and ${predicate}
				)`;
            const from = db
                .selectFrom("entries as e")
                .innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
                .innerJoin("entry_bodies as sw", (join) => join.on("sw.entry_id", "=", groupOf("e")).on("sw.state", "=", "working"))
                .leftJoin("entry_bodies as p", (join) => join.onRef("p.entry_id", "=", "e.id").on("p.state", "=", "published"))
                .leftJoin("content_addresses as cur", (join) => join.onRef("cur.entry_id", "=", "e.id").on("cur.type", "=", "current"))
                .where((eb) => {
                const conditions = [eb("e.collection", "=", params.collection)];
                // Group view keeps only the source as a row. Translations come attached in the row's `translations`.
                if (grouped) {
                    conditions.push(eb.or([eb("e.translation_group_id", "is", null), eb("e.translation_group_id", "=", eb.ref("e.id"))]));
                }
                if (params.statuses && params.statuses.length > 0) {
                    conditions.push(eb("e.status", "=", sql `any(${params.statuses}::text[])`));
                }
                else {
                    // The default list hides the trash.
                    conditions.push(eb("e.status", "<>", "trashed"));
                }
                if (params.folderId === null) {
                    conditions.push(eb("e.folder_id", "is", null));
                }
                else if (params.folderId !== undefined) {
                    conditions.push(params.includeDescendants
                        ? sql `e.folder_id in (
									with recursive descendants as (
										select id from ${sql.id(qSchema, "folders")} where id = ${params.folderId}
										union all
										select f.id from ${sql.id(qSchema, "folders")} f join descendants d on f.parent_id = d.id
									)
									select id from descendants
								)`
                        : eb("e.folder_id", "=", params.folderId));
                }
                if (params.search) {
                    const token = likeContainsPattern(params.search);
                    const matches = (alias, slug) => sql `(${sql.ref(slug)} ilike ${token} or ${titleOf(alias)} ilike ${token}${params.includeBody ? sql ` or ${sql.ref(`${alias}.search_text`)} ilike ${token}` : sql ``})`;
                    conditions.push(grouped
                        ? sql `(${matches("w", "e.working_slug")} or ${anyMember(matches("mw", "m.working_slug"))})`
                        : matches("w", "e.working_slug"));
                }
                if (params.titleContains) {
                    conditions.push(eb(titleOf("w"), "ilike", likeContainsPattern(params.titleContains)));
                }
                if (params.slugContains) {
                    conditions.push(eb("e.working_slug", "ilike", likeContainsPattern(params.slugContains)));
                }
                if (params.locales && params.locales.length > 0) {
                    const locales = sql `any(${params.locales}::text[])`;
                    conditions.push(grouped ? anyMember(sql `m.locale = ${locales}`) : eb("e.locale", "=", locales));
                }
                // Shared relation values are filtered by the source draft's values even for translations. For a source, `sw` is its own draft.
                const relationFields = relationFieldsOf(site, params.collection);
                for (const [field, ids] of Object.entries(params.relations ?? {})) {
                    const stored = relationFields.find((candidate) => candidate.name === field);
                    if (!stored || ids.length === 0)
                        continue;
                    const value = sql.ref(`${relationSource(stored)}.metadata`);
                    conditions.push(stored.field.kind === "relation" && stored.field.many
                        ? sql `coalesce(${value}->${field}, '[]'::jsonb) ?| ${ids}::text[]`
                        : sql `${value}->>${field} = any(${ids}::text[])`);
                }
                if (params.hasUnpublishedChanges !== undefined) {
                    conditions.push(params.hasUnpublishedChanges ? hasChanges("e") : sql `not ${hasChanges("e")}`);
                }
                const addRange = (column, range) => {
                    if (range?.from)
                        conditions.push(eb(column, ">=", range.from));
                    if (range?.to)
                        conditions.push(eb(column, "<=", range.to));
                };
                addRange("e.created_at", params.createdAt);
                addRange("e.updated_at", params.updatedAt);
                addRange("e.published_at", params.publishedAt);
                return eb.and(conditions);
            });
            const sortColumns = {
                updatedAt: sql.ref("e.updated_at"),
                createdAt: sql.ref("e.created_at"),
                publishedAt: sql.ref("e.published_at"),
                title: titleOf("w"),
                slug: sql.ref("e.working_slug"),
            };
            const sortColumn = sortColumns[params.sort?.field ?? "updatedAt"];
            const ascending = params.sort?.direction === "asc";
            const count = await from.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst();
            const total = Number(count?.count ?? 0);
            const dataRows = await from
                .select([
                "e.id",
                "e.collection",
                "e.locale",
                sql `coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
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
                const relationIdsByField = Object.fromEntries(relationFields.map((stored) => [
                    stored.name,
                    relationIds((relationSource(stored) === "w" ? meta : common)[stored.name]),
                ]));
                const values = Object.fromEntries(valueColumnFieldsOf(site, row.collection).flatMap((stored) => {
                    const { localized } = stored.field;
                    const value = localized
                        ? (meta[stored.name] ?? (localized === "inherit" ? common[stored.name] : undefined))
                        : common[stored.name];
                    return typeof value === "string" && value !== "" ? [[stored.name, value]] : [];
                }));
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
                        ? { recordLocales: namedLocales(site, row.collection, meta) }
                        : {}),
                };
            });
            const relatedIds = [
                ...new Set(baseItems.flatMap((item) => Object.values(item.relationIdsByField).flat())),
            ].filter(isUuid);
            const titleById = new Map();
            if (relatedIds.length > 0) {
                const rows = await db
                    .selectFrom("entries as e")
                    .leftJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "e.id").on("w.state", "=", "working"))
                    .leftJoin("entry_bodies as p", (join) => join.onRef("p.entry_id", "=", "e.id").on("p.state", "=", "published"))
                    .select([
                    sql `e.id::text`.as("id"),
                    sql `coalesce(nullif(${titleExpr(site, "w.metadata", ROW_COLLECTION)}, ''), nullif(${titleExpr(site, "p.metadata", ROW_COLLECTION)}, ''), e.working_slug)`.as("title"),
                ])
                    .where(sql `e.id::text = any(${relatedIds}::text[])`)
                    .execute();
                for (const row of rows)
                    if (row.title)
                        titleById.set(row.id, row.title);
            }
            const items = baseItems.map(({ relationIdsByField, ...item }) => ({
                ...item,
                relations: Object.fromEntries(Object.entries(relationIdsByField).map(([field, ids]) => [
                    field,
                    ids.map((id) => ({ id, title: titleById.get(id.toLowerCase()) ?? null })),
                ])),
            }));
            if (!grouped || items.length === 0)
                return { items, total, page, pageSize };
            const memberRows = await db
                .selectFrom("entries as m")
                .innerJoin("entry_bodies as w", (join) => join.onRef("w.entry_id", "=", "m.id").on("w.state", "=", "working"))
                .leftJoin("entry_bodies as p", (join) => join.onRef("p.entry_id", "=", "m.id").on("p.state", "=", "published"))
                .leftJoin("content_addresses as cur", (join) => join.onRef("cur.entry_id", "=", "m.id").on("cur.type", "=", "current"))
                .select([
                "m.id",
                sql `coalesce(m.translation_group_id, m.id)`.as("group_id"),
                "m.locale",
                "m.status",
                "m.version",
                hasChanges("m").as("has_changes"),
            ])
                .where(groupOf("m"), "=", sql `any(${items.map((item) => item.id)}::uuid[])`)
                .where("m.status", "<>", "trashed")
                .execute();
            const membersByGroup = new Map();
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
            const localeOrder = (locale) => {
                const index = site.LOCALES.indexOf(locale);
                return index === -1 ? site.LOCALES.length : index;
            };
            return {
                items: items.map((item) => ({
                    ...item,
                    translations: (membersByGroup.get(item.id) ?? []).sort((a, b) => localeOrder(a.locale) - localeOrder(b.locale)),
                })),
                total,
                page,
                pageSize,
            };
        },
    };
}

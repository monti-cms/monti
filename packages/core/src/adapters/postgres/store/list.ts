import { ENTRY_STATUSES, LIST_SORT_FIELDS, PAGE_SIZES } from "../../../core/api";
import { COLLECTIONS, type Collection, isItemCollection } from "../../../core/collections";
import { isUuid } from "../../../core/ids";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "../../../core/locales";
import { RECORD_TRANSLATIONS_KEY, recordLocalizedFields, storedFields } from "../../../schema/derive";
import type { StoredField } from "../../../schema/walk";
import type { StoreContext } from "./context";
import { CmsError } from "./errors";
import { likeContainsPattern } from "./sql";
import type {
	DateRange,
	EntryStatus,
	ListEntriesItem,
	ListEntriesParams,
	ListEntriesResult,
	ListTranslationMember,
} from "./types";

/**
 * 항목에서 값이 있는 언어. 언어별 텍스트 필드(`localized: true`) 중 하나라도 값이 있으면 그 언어가 있다. 기본 언어는 필드 자체,
 * 다른 언어는 `translations[언어][필드]`다.
 */
function namedLocales(collection: Collection, metadata: Record<string, unknown>): string[] {
	const fields = recordLocalizedFields(collection);
	const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {}) as Record<string, Record<string, unknown> | undefined>;
	const hasValue = (value: unknown) => typeof value === "string" && value.trim() !== "";
	return LOCALES.filter((locale) =>
		fields.some((field) => hasValue(locale === DEFAULT_LOCALE ? metadata[field] : translations[locale]?.[field])),
	);
}

const isDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());

/** 컬렉션의 관계 필드. 목록 필터와 줄의 `relations`가 쓴다. */
const relationFieldsOf = (collection: string): StoredField[] =>
	storedFields(collection as Collection).filter((stored) => stored.field.kind === "relation");

/** 목록 칸에 글자로 보여 줄 필드(관계는 `relations`가 따로 담는다). */
const valueColumnFieldsOf = (collection: string): StoredField[] =>
	storedFields(collection as Collection).filter((stored) => ["text", "select", "media"].includes(stored.field.kind));

/** 관계 값을 읽을 초안. 언어별 값이 아니면 번역 묶음 공통 값이라 원문 초안(`sw`)에서 읽는다(v2 B4). */
const relationSource = (stored: StoredField): "w" | "sw" => (stored.field.localized ? "w" : "sw");

const relationIds = (value: unknown): string[] =>
	typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

function assertParams(params: ListEntriesParams) {
	if (typeof params !== "object" || params === null || Array.isArray(params)) {
		throw new CmsError("Invalid parameters", "invalid_input");
	}
	if (!(COLLECTIONS as readonly string[]).includes(params.collection)) {
		throw new CmsError("Invalid collection", "invalid_input");
	}
	for (const key of ["search", "titleContains", "slugContains"] as const) {
		if (params[key] !== undefined && typeof params[key] !== "string")
			throw new CmsError(`Invalid ${key}`, "invalid_input");
	}
	for (const key of ["includeBody", "includeDescendants", "hasUnpublishedChanges", "groupTranslations"] as const) {
		if (params[key] !== undefined && typeof params[key] !== "boolean")
			throw new CmsError(`Invalid ${key}`, "invalid_input");
	}
	if (params.statuses !== undefined) {
		if (!Array.isArray(params.statuses) || params.statuses.some((s) => !ENTRY_STATUSES.includes(s))) {
			throw new CmsError("Invalid status", "invalid_input");
		}
	}
	if (params.locales !== undefined && (!Array.isArray(params.locales) || params.locales.some((l) => !isLocale(l)))) {
		throw new CmsError("Invalid locale", "invalid_input");
	}
	if (params.relations !== undefined) {
		if (typeof params.relations !== "object" || params.relations === null || Array.isArray(params.relations)) {
			throw new CmsError("Invalid relations", "invalid_input");
		}
		const fields = new Set(relationFieldsOf(params.collection).map((stored) => stored.name));
		for (const [field, ids] of Object.entries(params.relations)) {
			if (!fields.has(field)) throw new CmsError(`Unknown relation field: ${field}`, "invalid_input");
			if (!Array.isArray(ids) || ids.some((id) => !isUuid(id))) {
				throw new CmsError(`Invalid ${field} filter`, "invalid_input");
			}
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

/** §3.2 관리자 목록. 검색·필터·정렬·페이지를 서버에서 처리한다. */
export function createListOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

	return {
		listEntries: async (params: ListEntriesParams): Promise<ListEntriesResult> => {
			assertParams(params);
			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;

			const conditions: string[] = [];
			const values: unknown[] = [];
			const bind = (value: unknown) => {
				values.push(value);
				return `$${values.length}`;
			};

			conditions.push(`e.collection = ${bind(params.collection)}`);
			const grouped = params.groupTranslations === true;
			// 묶음 보기는 원문만 줄로 둔다. 번역본은 줄의 `translations`로 딸려 온다.
			if (grouped) conditions.push("(e.translation_group_id IS NULL OR e.translation_group_id = e.id)");
			/** 같은 묶음에서 휴지통 밖에 있는 콘텐츠(원문 포함)가 조건을 만족하는지. */
			const anyMember = (predicate: string) =>
				`EXISTS (
					SELECT 1 FROM "${qSchema}".entries m
					JOIN "${qSchema}".entry_bodies mw ON mw.entry_id = m.id AND mw.state = 'working'
					WHERE COALESCE(m.translation_group_id, m.id) = e.id AND m.status <> 'trashed' AND ${predicate}
				)`;
			if (params.statuses && params.statuses.length > 0) {
				conditions.push(`e.status = ANY(${bind(params.statuses)}::text[])`);
			} else {
				// 기본 목록은 휴지통을 숨긴다(§5.3).
				conditions.push(`e.status <> 'trashed'`);
			}

			if (params.folderId === null) {
				conditions.push("e.folder_id IS NULL");
			} else if (params.folderId !== undefined) {
				conditions.push(
					params.includeDescendants
						? `e.folder_id IN (
							WITH RECURSIVE descendants AS (
								SELECT id FROM "${qSchema}".folders WHERE id = ${bind(params.folderId)}
								UNION ALL
								SELECT f.id FROM "${qSchema}".folders f JOIN descendants d ON f.parent_id = d.id
							)
							SELECT id FROM descendants
						)`
						: `e.folder_id = ${bind(params.folderId)}`,
				);
			}

			if (params.search) {
				const token = bind(likeContainsPattern(params.search));
				const matches = (alias: string, slug: string) =>
					`(${slug} ILIKE ${token} OR ${alias}.metadata->>'title' ILIKE ${token}${
						params.includeBody ? ` OR ${alias}.search_text ILIKE ${token}` : ""
					})`;
				conditions.push(
					grouped
						? `(${matches("w", "e.working_slug")} OR ${anyMember(matches("mw", "m.working_slug"))})`
						: matches("w", "e.working_slug"),
				);
			}
			if (params.titleContains) {
				conditions.push(`w.metadata->>'title' ILIKE ${bind(likeContainsPattern(params.titleContains))}`);
			}
			if (params.slugContains) {
				conditions.push(`e.working_slug ILIKE ${bind(likeContainsPattern(params.slugContains))}`);
			}
			if (params.locales && params.locales.length > 0) {
				const locales = `${bind(params.locales)}::text[]`;
				conditions.push(grouped ? anyMember(`m.locale = ANY(${locales})`) : `e.locale = ANY(${locales})`);
			}
			// 공통 관계 값은 번역본도 원문 초안의 값으로 거른다(v2 B4). 원문은 `sw`가 자기 초안이다.
			const relationFields = relationFieldsOf(params.collection);
			for (const [field, ids] of Object.entries(params.relations ?? {})) {
				const stored = relationFields.find((candidate) => candidate.name === field);
				if (!stored || ids.length === 0) continue;
				const value = `${relationSource(stored)}.metadata`;
				conditions.push(
					stored.field.kind === "relation" && stored.field.many
						? `COALESCE(${value}->${bind(field)}, '[]'::jsonb) ?| ${bind(ids)}::text[]`
						: `${value}->>${bind(field)} = ANY(${bind(ids)}::text[])`,
				);
			}
			if (params.hasUnpublishedChanges !== undefined) {
				const changed =
					"(p.entry_id IS NOT NULL AND (p.content_hash <> w.content_hash OR e.working_slug IS DISTINCT FROM cur.slug))";
				conditions.push(params.hasUnpublishedChanges ? changed : `NOT ${changed}`);
			}
			const addRange = (column: string, range: DateRange | undefined) => {
				if (range?.from) conditions.push(`${column} >= ${bind(range.from)}`);
				if (range?.to) conditions.push(`${column} <= ${bind(range.to)}`);
			};
			addRange("e.created_at", params.createdAt);
			addRange("e.updated_at", params.updatedAt);
			addRange("e.published_at", params.publishedAt);

			const sortColumns: Record<(typeof LIST_SORT_FIELDS)[number], string> = {
				updatedAt: "e.updated_at",
				createdAt: "e.created_at",
				publishedAt: "e.published_at",
				title: "w.metadata->>'title'",
				slug: "e.working_slug",
			};
			const sortColumn = sortColumns[params.sort?.field ?? "updatedAt"];
			const sortDir = params.sort?.direction === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST";

			const from = `
				FROM "${qSchema}".entries e
				JOIN "${qSchema}".entry_bodies w ON w.entry_id = e.id AND w.state = 'working'
				JOIN "${qSchema}".entry_bodies sw ON sw.entry_id = COALESCE(e.translation_group_id, e.id) AND sw.state = 'working'
				LEFT JOIN "${qSchema}".entry_bodies p ON p.entry_id = e.id AND p.state = 'published'
				LEFT JOIN "${qSchema}".content_addresses cur ON cur.entry_id = e.id AND cur.type = 'current'
				WHERE ${conditions.join(" AND ")}`;

			const countRes = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count ${from}`, values);
			const total = Number(countRes.rows[0]?.count ?? 0);

			const dataRes = await pool.query<{
				id: string;
				collection: string;
				locale: string;
				translation_group_id: string;
				status: EntryStatus;
				version: number;
				folder_id: string | null;
				created_at: Date;
				updated_at: Date;
				published_at: Date | null;
				trashed_at: Date | null;
				working_slug: string | null;
				metadata: Record<string, unknown>;
				source_metadata: Record<string, unknown>;
				has_changes: boolean;
			}>(
				`SELECT e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
				        e.status, e.version, e.folder_id, e.created_at, e.updated_at, e.published_at,
				        e.trashed_at, e.working_slug, w.metadata, sw.metadata AS source_metadata,
				        (p.entry_id IS NOT NULL AND (p.content_hash <> w.content_hash OR e.working_slug IS DISTINCT FROM cur.slug)) AS has_changes
				 ${from}
				 ORDER BY ${sortColumn} ${sortDir}, e.id ASC
				 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
				values,
			);

			const baseItems = dataRes.rows.map((row) => {
				const meta = row.metadata ?? {};
				// 공통 관계 값은 원문 초안에서 읽는다(v2 B4).
				const common = row.source_metadata ?? meta;
				const relationIdsByField = Object.fromEntries(
					relationFields.map((stored) => [
						stored.name,
						relationIds((relationSource(stored) === "w" ? meta : common)[stored.name]),
					]),
				);
				const values = Object.fromEntries(
					valueColumnFieldsOf(row.collection).flatMap((stored) => {
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
					title: typeof meta.title === "string" ? meta.title : null,
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
					...(isItemCollection(row.collection)
						? { recordLocales: namedLocales(row.collection as Collection, meta) }
						: {}),
				};
			});

			const relatedIds = [
				...new Set(baseItems.flatMap((item) => Object.values(item.relationIdsByField).flat())),
			].filter(isUuid);
			const titleById = new Map<string, string>();
			if (relatedIds.length > 0) {
				const res = await pool.query<{ id: string; title: string | null }>(
					`SELECT e.id::text AS id,
						COALESCE(NULLIF(w.metadata->>'title', ''), NULLIF(p.metadata->>'title', ''), e.working_slug) AS title
					 FROM "${qSchema}".entries e
					 LEFT JOIN "${qSchema}".entry_bodies w ON w.entry_id = e.id AND w.state = 'working'
					 LEFT JOIN "${qSchema}".entry_bodies p ON p.entry_id = e.id AND p.state = 'published'
					 WHERE e.id::text = ANY($1::text[])`,
					[relatedIds],
				);
				for (const row of res.rows) if (row.title) titleById.set(row.id, row.title);
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

			const memberRes = await pool.query<{
				id: string;
				group_id: string;
				locale: string;
				status: EntryStatus;
				version: number;
				has_changes: boolean;
			}>(
				`SELECT m.id, COALESCE(m.translation_group_id, m.id) AS group_id, m.locale, m.status, m.version,
				        (p.entry_id IS NOT NULL AND (p.content_hash <> w.content_hash OR m.working_slug IS DISTINCT FROM cur.slug)) AS has_changes
				 FROM "${qSchema}".entries m
				 JOIN "${qSchema}".entry_bodies w ON w.entry_id = m.id AND w.state = 'working'
				 LEFT JOIN "${qSchema}".entry_bodies p ON p.entry_id = m.id AND p.state = 'published'
				 LEFT JOIN "${qSchema}".content_addresses cur ON cur.entry_id = m.id AND cur.type = 'current'
				 WHERE COALESCE(m.translation_group_id, m.id) = ANY($1::uuid[]) AND m.status <> 'trashed'`,
				[items.map((item) => item.id)],
			);
			const membersByGroup = new Map<string, ListTranslationMember[]>();
			for (const row of memberRes.rows) {
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
				const index = (LOCALES as readonly string[]).indexOf(locale);
				return index === -1 ? LOCALES.length : index;
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

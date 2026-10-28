import {
	type Collection,
	type FieldCondition,
	LIST_SORT_FIELDS,
	type ListSortField,
	type Locale,
	type PageSize,
	type Site,
	TRANSLATION_FILTERS,
	type TranslationFilter,
} from "@monti-cms/core/site";
import { pageParam, pageSizeParam } from "../lib/hooks/use-url-state";
import { type DateFilter, dateRangeOf, parseDateFilter, writeDateFilter } from "./list-dates";
import { filterFieldOf, readCondition, takesCondition, writeCondition } from "./list-filter-fields";

/**
 * The states of the status column a list can be filtered by (the order of the column's menu). `published` has no unpublished changes and `editing` is
 * published with changes. The trash is seen only in its dedicated screen.
 */
export type ListStatus = "published" | "editing" | "draft" | "archived";
export const LIST_STATUS_ORDER: readonly ListStatus[] = ["published", "editing", "draft", "archived"];

/**
 * Admin list state. Reflects folder, search, filters, sort and page in the URL so Back restores it.
 * Page size, sort defaults and columns are saved in per-collection user settings.
 */
export interface ListState {
	collection: Collection;
	/**
	 * `all` is the top level (root of the folders); anything else is a folder ID. In browse mode the top level shows only top-level folders and items outside folders.
	 */
	folder: string;
	includeDescendants: boolean;
	search: string;
	includeBody: boolean;
	/** Empty means everything except trash. Multiple values are OR. */
	statuses: ListStatus[];
	/** Conditions on stored fields, by field name. Several on one field are OR; different fields are AND. */
	fields: Readonly<Record<string, readonly FieldCondition[]>>;
	/** Content locale. Empty means all locales. */
	locales: Locale[];
	/** Where the translation group stands. Empty means all. Multiple values are OR. */
	translations: TranslationFilter[];
	/** The updated, published and created dates: a preset (kept relative) or a range of days. `null` means any. */
	updated: DateFilter | null;
	published: DateFilter | null;
	created: DateFilter | null;
	sortField: ListSortField;
	sortDirection: "asc" | "desc";
	page: number;
	pageSize: PageSize;
}

export const DEFAULT_LIST_STATE: Omit<ListState, "collection"> = {
	folder: "all",
	includeDescendants: false,
	search: "",
	includeBody: false,
	statuses: [],
	fields: {},
	locales: [],
	translations: [],
	updated: null,
	published: null,
	created: null,
	sortField: "updatedAt",
	sortDirection: "desc",
	page: 1,
	pageSize: 25,
};

/** Reads `field=name:condition` (repeated) into conditions per field. Keeps only fields the filter menu offers for this collection, with a condition their kind takes. */
function readFields(site: Site, values: readonly string[], collection: Collection): Record<string, FieldCondition[]> {
	const fields: Record<string, FieldCondition[]> = {};
	for (const value of values) {
		const read = readCondition(value);
		const field = read && filterFieldOf(site, collection, read.name);
		if (!read || !field || !takesCondition(field.kind, read.condition.kind)) continue;
		const known = fields[read.name] ?? [];
		const same = (candidate: FieldCondition) =>
			candidate.kind === read.condition.kind &&
			(candidate.kind !== "is" || (read.condition.kind === "is" && candidate.value === read.condition.value));
		if (!known.some(same)) fields[read.name] = [...known, read.condition];
	}
	return fields;
}

export function parseListState(
	site: Site,
	params: URLSearchParams,
): ListState & { explicit: { pageSize: boolean; sort: boolean } } {
	const collection = params.get("collection");
	const sortField = params.get("sortField") ?? "";
	const statuses = [...new Set(params.getAll("status"))].filter((status): status is ListStatus =>
		(LIST_STATUS_ORDER as readonly string[]).includes(status),
	);
	const listed = site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION;
	const folder = params.get("folder");
	const state: ListState = {
		...DEFAULT_LIST_STATE,
		collection: listed,
		// A collection without folders has no folder to be in, so a `?folder=` left in the URL is ignored.
		folder: !site.foldersEnabled(listed) || !folder ? "all" : folder,
		includeDescendants: params.get("descendants") === "1",
		search: params.get("search") ?? "",
		includeBody: params.get("body") === "1",
		statuses,
		fields: readFields(site, params.getAll("field"), listed),
		// The locale filter is hidden without translations, so a `?locale=` left in the URL must not filter the list.
		locales: site.ADMIN_TRANSLATIONS ? [...new Set(params.getAll("locale"))].filter(site.isLocale) : [],
		translations:
			site.ADMIN_TRANSLATIONS && site.isDocumentCollection(listed)
				? [...new Set(params.getAll("translation"))].filter((value): value is TranslationFilter =>
						(TRANSLATION_FILTERS as readonly string[]).includes(value),
					)
				: [],
		updated: parseDateFilter(params.get("updated")),
		// An item collection is never published: its list has no published date to filter by.
		published: site.isDocumentCollection(listed) ? parseDateFilter(params.get("published")) : null,
		created: parseDateFilter(params.get("created")),
		sortField: (LIST_SORT_FIELDS as readonly string[]).includes(sortField)
			? (sortField as ListSortField)
			: DEFAULT_LIST_STATE.sortField,
		sortDirection: params.get("sortDirection") === "asc" ? "asc" : "desc",
		page: pageParam.parse(params.get("page")),
		pageSize: pageSizeParam.parse(params.get("pageSize")),
	};
	return { ...state, explicit: { pageSize: params.has("pageSize"), sort: params.has("sortField") } };
}

/** Writes search, filters and sort as a URL query. */
function appendFilterParams(params: URLSearchParams, state: ListState) {
	const set = (key: string, value: string, fallback: string) => {
		if (value !== fallback) params.set(key, value);
	};
	set("search", state.search, "");
	if (state.includeBody) params.set("body", "1");
	for (const status of state.statuses) params.append("status", status);
	for (const [name, conditions] of Object.entries(state.fields))
		for (const condition of conditions) params.append("field", writeCondition(name, condition));
	for (const locale of state.locales) params.append("locale", locale);
	for (const translation of state.translations) params.append("translation", translation);
	if (state.updated) params.set("updated", writeDateFilter(state.updated));
	if (state.published) params.set("published", writeDateFilter(state.published));
	if (state.created) params.set("created", writeDateFilter(state.created));
	params.set("sortField", state.sortField);
	params.set("sortDirection", state.sortDirection);
}

/** Values equal to the defaults are not written to the URL. */
export function listStateToSearchParams(state: ListState): URLSearchParams {
	const params = new URLSearchParams({ collection: state.collection });
	if (state.folder !== "all") params.set("folder", state.folder);
	if (state.includeDescendants) params.set("descendants", "1");
	appendFilterParams(params, state);
	if (state.page !== 1) params.set("page", String(state.page));
	params.set("pageSize", String(state.pageSize));
	return params;
}

const zonedDayBoundary = (site: Site, date: string, end: boolean) => {
	const parsed = site.parseDateTimeInput(`${date}T${end ? "23:59" : "00:00"}`);
	if (!parsed) return null;
	return end ? new Date(Date.parse(parsed) + 59_999).toISOString() : parsed;
};

/**
 * List API (`GET /entries`) query. Multiple values of the same filter are OR; different filters are AND.
 * With `trash`, requests only trashed items.
 * Publishable collections (`kind: "document"`) are requested one row per translation group. Trash lists items individually so a single translation can be restored.
 */
export function listStateToApiQuery(
	site: Site,
	state: ListState,
	options: { trash?: boolean; now?: Date } = {},
): URLSearchParams {
	const query = new URLSearchParams({
		collection: state.collection,
		sortField: state.sortField,
		sortDirection: state.sortDirection,
		page: String(state.page),
		pageSize: String(state.pageSize),
	});
	if (!options.trash && site.schemaOf(state.collection).kind === "document") query.set("group", "translation");
	// A collection without folders lists everything: entries filed in folders before its folders were turned off stay in the list.
	if (!options.trash && site.foldersEnabled(state.collection)) {
		// Browse mode shows only items directly in the current location; search, filters or "include subfolders" show everything under the current location.
		const flat = !isExplorerMode(state);
		if (state.folder === "all") {
			if (!flat) query.set("folderId", "null");
		} else {
			query.set("folderId", state.folder);
			if (flat) query.set("includeDescendants", "true");
		}
	}
	if (state.search.trim()) query.set("search", state.search.trim());
	if (state.includeBody) query.set("includeBody", "true");
	if (options.trash) query.append("status", "trashed");
	else for (const status of state.statuses) query.append("status", status);
	for (const [name, conditions] of Object.entries(state.fields))
		for (const condition of conditions) query.append("field", writeCondition(name, condition));
	for (const locale of state.locales) query.append("locale", locale);
	for (const translation of state.translations) query.append("translation", translation);
	for (const [key, filter] of [
		["updated", state.updated],
		["published", state.published],
		["created", state.created],
	] as const) {
		if (!filter) continue;
		const { from, to } = dateRangeOf(site, filter, options.now);
		const start = zonedDayBoundary(site, from, false);
		const end = zonedDayBoundary(site, to, true);
		if (start) query.set(`${key}From`, start);
		if (end) query.set(`${key}To`, end);
	}
	return query;
}

/**
 * `GET /entries/counts` query for the numbers beside a column menu's values: one field (`{ field }`), the translation filter or the status. It counts what
 * the list would show before any filter: the current folder with its subfolders.
 */
export function listStateToCountsQuery(
	site: Site,
	state: ListState,
	facet: { field: string } | "translation" | "status",
): URLSearchParams {
	const query = new URLSearchParams({ collection: state.collection });
	if (typeof facet === "string") query.set("facet", facet);
	else query.set("field", facet.field);
	if (site.schemaOf(state.collection).kind === "document") query.set("group", "translation");
	if (site.foldersEnabled(state.collection) && state.folder !== "all") {
		query.set("folderId", state.folder);
		query.set("includeDescendants", "true");
	}
	return query;
}

/** Number of filters that narrow the list: the status, each field with a condition, and the language, translation and date filters. Search is not counted. */
export const activeFilterCount = (state: ListState) =>
	[
		state.statuses.length > 0,
		...Object.values(state.fields).map((conditions) => conditions.length > 0),
		state.locales.length > 0,
		state.translations.length > 0,
		state.updated !== null,
		state.published !== null,
		state.created !== null,
	].filter(Boolean).length;

/**
 * Folder browse mode: with no search or filter and "include subfolders" off, shows only the subfolders and directly contained items of the current location, like a file explorer.
 * Otherwise shows all items under the current location flat, without folder separation.
 */
export function isExplorerMode(state: ListState): boolean {
	return !state.search.trim() && activeFilterCount(state) === 0 && !state.includeDescendants;
}

/** The patch that clears search and filters only; the folder, its subfolder setting, the page size and the sort stay as they are. */
export function clearFiltersPatch(state: ListState): Partial<ListState> {
	const {
		collection: _c,
		folder: _f,
		includeDescendants: _d,
		pageSize: _p,
		sortField: _s,
		sortDirection: _sd,
		...rest
	} = {
		...state,
		search: "",
		includeBody: false,
		statuses: [],
		fields: {},
		locales: [],
		translations: [],
		updated: null,
		published: null,
		created: null,
		page: 1,
	};
	return rest;
}

/** Whether a search or any filter narrows the list. */
export const isFiltered = (state: ListState): boolean => state.search.trim() !== "" || activeFilterCount(state) > 0;

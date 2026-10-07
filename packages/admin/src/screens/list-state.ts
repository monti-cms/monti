import {
	type Collection,
	LIST_SORT_FIELDS,
	type ListSortField,
	type Locale,
	type PageSize,
	type Site,
} from "@monti-cms/core/client";
import type { EntryStatus } from "./shared/entry-status";

/** Statuses that can be filtered in the list. Trash is seen only in its dedicated screen. */
export type ListStatus = Exclude<EntryStatus, "trashed">;
export const LIST_STATUSES: readonly ListStatus[] = ["draft", "published", "archived"];

/**
 * Admin list state. Reflects folder, search, filters, sort and page in the URL so Back restores it.
 * Page size, sort defaults and columns are saved in per-collection user settings.
 */
export interface ListState {
	collection: Collection;
	/**
	 * `all` is the top level (root of the folders); anything else is a folder ID. In browse mode the top level shows only top-level folders and items outside folders.
	 * `unfiled` in old addresses is read as the top level.
	 */
	folder: string;
	includeDescendants: boolean;
	search: string;
	includeBody: boolean;
	/** Column header filter: partial match on title only / slug only. */
	titleContains: string;
	slugContains: string;
	/** Empty means everything except trash. Multiple values are OR. */
	statuses: ListStatus[];
	hasChanges: boolean;
	/** Taxonomy field name -> chosen item IDs. Multiple values of the same field are OR; different fields are AND. */
	relations: Readonly<Record<string, readonly string[]>>;
	/** Content locale. Empty means all locales. */
	locales: Locale[];
	/** `YYYY-MM-DD` (date in the configured time zone). */
	createdFrom: string;
	createdTo: string;
	updatedFrom: string;
	updatedTo: string;
	publishedFrom: string;
	publishedTo: string;
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
	titleContains: "",
	slugContains: "",
	statuses: [],
	hasChanges: false,
	relations: {},
	locales: [],
	createdFrom: "",
	createdTo: "",
	updatedFrom: "",
	updatedTo: "",
	publishedFrom: "",
	publishedTo: "",
	sortField: "updatedAt",
	sortDirection: "desc",
	page: 1,
	pageSize: 25,
};

export const DATE_KEYS = [
	"createdFrom",
	"createdTo",
	"updatedFrom",
	"updatedTo",
	"publishedFrom",
	"publishedTo",
] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Reads `relation=field:ID` (repeated) into per-taxonomy-field ID lists. Drops fields that are not taxonomy fields of this collection. */
function readRelations(site: Site, values: readonly string[], collection: Collection): Record<string, string[]> {
	const fields = new Set(site.taxonomyFieldsOf(collection).map((stored) => stored.name));
	const relations: Record<string, string[]> = {};
	for (const value of values) {
		const at = value.indexOf(":");
		const field = value.slice(0, at);
		const id = value.slice(at + 1);
		if (at <= 0 || !id || !fields.has(field)) continue;
		relations[field] = [...new Set([...(relations[field] ?? []), id])];
	}
	return relations;
}

/** Writes taxonomy filters as an address / list API query (`relation=field:ID`). */
function appendRelations(params: URLSearchParams, relations: ListState["relations"]) {
	for (const [field, ids] of Object.entries(relations))
		for (const id of ids) params.append("relation", `${field}:${id}`);
}

export function parseListState(
	site: Site,
	params: URLSearchParams,
): ListState & { explicit: { pageSize: boolean; sort: boolean } } {
	const collection = params.get("collection");
	const pageSize = Number(params.get("pageSize"));
	const page = Number(params.get("page"));
	const sortField = params.get("sortField") ?? "";
	const statuses = [...new Set(params.getAll("status"))].filter((status): status is ListStatus =>
		(LIST_STATUSES as readonly string[]).includes(status),
	);
	const state: ListState = {
		...DEFAULT_LIST_STATE,
		collection: site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION,
		folder: !params.get("folder") || params.get("folder") === "unfiled" ? "all" : (params.get("folder") as string),
		includeDescendants: params.get("descendants") === "1",
		search: params.get("search") ?? "",
		includeBody: params.get("body") === "1",
		titleContains: params.get("title") ?? "",
		slugContains: params.get("slug") ?? "",
		statuses,
		hasChanges: params.get("changes") === "1",
		relations: readRelations(
			site,
			params.getAll("relation"),
			site.isCollection(collection) ? collection : site.DEFAULT_COLLECTION,
		),
		locales: [...new Set(params.getAll("locale"))].filter(site.isLocale),
		sortField: (LIST_SORT_FIELDS as readonly string[]).includes(sortField)
			? (sortField as ListSortField)
			: DEFAULT_LIST_STATE.sortField,
		sortDirection: params.get("sortDirection") === "asc" ? "asc" : "desc",
		page: Number.isInteger(page) && page > 0 ? page : 1,
		pageSize: pageSize === 50 || pageSize === 100 ? pageSize : 25,
	};
	for (const key of DATE_KEYS) {
		const value = params.get(key) ?? "";
		state[key] = DATE_PATTERN.test(value) ? value : "";
	}
	return { ...state, explicit: { pageSize: params.has("pageSize"), sort: params.has("sortField") } };
}

/** Writes search, filters and sort as a URL query. */
function appendFilterParams(params: URLSearchParams, state: ListState) {
	const set = (key: string, value: string, fallback: string) => {
		if (value !== fallback) params.set(key, value);
	};
	set("search", state.search, "");
	if (state.includeBody) params.set("body", "1");
	set("title", state.titleContains, "");
	set("slug", state.slugContains, "");
	for (const status of state.statuses) params.append("status", status);
	if (state.hasChanges) params.set("changes", "1");
	appendRelations(params, state.relations);
	for (const locale of state.locales) params.append("locale", locale);
	for (const key of DATE_KEYS) set(key, state[key], "");
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
export function listStateToApiQuery(site: Site, state: ListState, options: { trash?: boolean } = {}): URLSearchParams {
	const query = new URLSearchParams({
		collection: state.collection,
		sortField: state.sortField,
		sortDirection: state.sortDirection,
		page: String(state.page),
		pageSize: String(state.pageSize),
	});
	if (!options.trash && site.schemaOf(state.collection).kind === "document") query.set("group", "translation");
	if (!options.trash) {
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
	if (state.titleContains.trim()) query.set("titleContains", state.titleContains.trim());
	if (state.slugContains.trim()) query.set("slugContains", state.slugContains.trim());
	if (options.trash) query.append("status", "trashed");
	else for (const status of state.statuses) query.append("status", status);
	if (state.hasChanges) query.set("hasChanges", "true");
	appendRelations(query, state.relations);
	for (const locale of state.locales) query.append("locale", locale);
	for (const key of DATE_KEYS) {
		if (!state[key]) continue;
		const boundary = zonedDayBoundary(site, state[key], key.endsWith("To"));
		if (boundary) query.set(key, boundary);
	}
	return query;
}

/** Number of header filters, excluding search. */
export const activeFilterCount = (state: ListState) =>
	[
		state.titleContains.trim(),
		state.slugContains.trim(),
		state.statuses.length > 0,
		state.hasChanges,
		...Object.values(state.relations).map((ids) => ids.length > 0),
		state.locales.length > 0,
		...DATE_KEYS.map((key) => state[key]),
	].filter(Boolean).length;

/**
 * Folder browse mode: with no search or filter and "include subfolders" off, shows only the subfolders and directly contained items of the current location, like a file explorer.
 * Otherwise shows all items under the current location flat, without folder separation.
 */
export function isExplorerMode(state: ListState): boolean {
	return !state.search.trim() && activeFilterCount(state) === 0 && !state.includeDescendants;
}

/** State with all search and filters cleared (sort, folder and page size kept). */
export function clearFilters(state: ListState): ListState {
	return {
		...state,
		search: "",
		includeBody: false,
		titleContains: "",
		slugContains: "",
		statuses: [],
		hasChanges: false,
		relations: {},
		locales: [],
		createdFrom: "",
		createdTo: "",
		updatedFrom: "",
		updatedTo: "",
		publishedFrom: "",
		publishedTo: "",
		page: 1,
	};
}

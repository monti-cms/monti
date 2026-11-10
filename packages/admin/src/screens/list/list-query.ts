import type { ListColumn, ListFilter } from "@monti-cms/core";

/**
 * The list's query in its address (doc 06: filters, search and sort live in the address only). One key per filter, values comma-joined:
 * `?status=draft,changed&tags=<group>,~none&summary=empty&updatedAt=7d&locale=en&translation=sourceChanged&sort=-updatedAt&q=text&in=title&page=2`.
 * The language column holds two: its languages (`locale`) and its translation filter (`translation`, with the languages it asks about after a colon
 * when the assistant named them). `ai` names the filters the assistant set (`list.show`), drawn as blue chips until the admin touches them.
 */
export type ListState = {
	filters: ListFilter[];
	search: { text: string; in: SearchIn };
	sort: { by: "title" | "slug" | "updatedAt" | "publishedAt" | "createdAt"; dir: "asc" | "desc" };
	page: number;
	ai: string[];
	/** The open folder (`null`: the top level), and whether a search in it looks through the whole collection (doc 07; `?folder=<id>&scope=all`). Filters alone look in the folder. */
	folder: string | null;
	everywhere: boolean;
};

export const NONE = "~none";
/** Where the search looks: everywhere first, or only the title, the address or the body (screens/list.md, the search row). */
export const SEARCH_IN = ["all", "title", "slug", "body"] as const;
type SearchIn = (typeof SEARCH_IN)[number];
const SORTABLE = new Set(["title", "slug", "updatedAt", "publishedAt", "createdAt"]);
const RANGE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** The language column's translation filters, in their menu's order (doc 06, columns). */
export const TRANSLATION_STATES = ["missing", "sourceChanged", "upToDate"] as const;
type TranslationState = (typeof TRANSLATION_STATES)[number];
const TRANSLATION = /^((?:missing|sourceChanged|upToDate)(?:,(?:missing|sourceChanged|upToDate))*)(?::(.+))?$/;

const values = (raw: string) => raw.split(",").filter(Boolean);
const orNull = (value: string) => (value === NONE ? null : value);

/** A filter's key: its key in the address, and the one filter of that key a menu replaces. */
export const filterColumn = (filter: ListFilter) =>
	filter.on === "status" || filter.on === "locale" || filter.on === "group" || filter.on === "translation"
		? filter.on
		: filter.field;

/** The column whose head shows a filter's dot and whose menu sets it: the translation filter is the language column's. */
export const headOf = (filter: ListFilter) => (filter.on === "translation" ? "locale" : filterColumn(filter));

/** Reads the address with the collection's columns: a key no column filters by is left out, so an old link never breaks the list. */
export function readState(params: URLSearchParams, columns: readonly ListColumn[]): ListState {
	const filters: ListFilter[] = [];
	for (const column of columns) {
		// The language column's translation filter has its own key; a site with one language has no such column, so it never reads one.
		const translation = column.filter === "locale" ? TRANSLATION.exec(params.get("translation") ?? "") : null;
		if (translation)
			filters.push({
				on: "translation",
				any: values(translation[1] ?? "") as TranslationState[],
				...(translation[2] ? { locales: values(translation[2]) } : {}),
			});
		const raw = params.get(column.id);
		if (!raw || !column.filter) continue;
		switch (column.filter) {
			case "status":
				filters.push({ on: "status", any: values(raw) as ("published" | "changed" | "draft" | "archived")[] });
				break;
			case "locale":
				filters.push({ on: "locale", any: values(raw) });
				break;
			case "relation":
			case "select":
				filters.push({ on: column.filter, field: column.id, any: values(raw).map(orNull) });
				break;
			case "empty":
				if (raw === "empty") filters.push({ on: "empty", field: column.id });
				break;
			case "date": {
				const range = RANGE.exec(raw);
				if (raw === "today" || raw === "7d" || raw === "30d")
					filters.push({ on: "date", field: column.id as "updatedAt", range: raw });
				else if (range)
					filters.push({ on: "date", field: column.id as "updatedAt", range: { from: range[1], to: range[2] } });
				break;
			}
		}
	}
	const sortRaw = params.get("sort") ?? "-updatedAt";
	const by = sortRaw.replace(/^-/, "");
	const page = Number(params.get("page") ?? "1");
	return {
		filters,
		search: { text: params.get("q") ?? "", in: SEARCH_IN.find((place) => place === params.get("in")) ?? "all" },
		sort: SORTABLE.has(by)
			? { by: by as ListState["sort"]["by"], dir: sortRaw.startsWith("-") ? "desc" : "asc" }
			: { by: "updatedAt", dir: "desc" },
		page: Number.isInteger(page) && page > 0 ? page : 1,
		ai: values(params.get("ai") ?? ""),
		folder: params.get("folder"),
		everywhere: params.get("scope") === "all",
	};
}

export function writeState(state: ListState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.folder) params.set("folder", state.folder);
	if (state.folder && state.everywhere) params.set("scope", "all");
	if (state.search.text) params.set("q", state.search.text);
	if (state.search.in !== "all") params.set("in", state.search.in);
	for (const filter of state.filters) {
		const key = filterColumn(filter);
		if (filter.on === "empty") params.set(key, "empty");
		else if (filter.on === "translation")
			params.set(key, `${filter.any.join(",")}${filter.locales ? `:${filter.locales.join(",")}` : ""}`);
		else if (filter.on === "date")
			params.set(key, typeof filter.range === "string" ? filter.range : `${filter.range.from}..${filter.range.to}`);
		else params.set(key, filter.any.map((value) => value ?? NONE).join(","));
	}
	const sort = `${state.sort.dir === "desc" ? "-" : ""}${state.sort.by}`;
	if (sort !== "-updatedAt") params.set("sort", sort);
	if (state.page > 1) params.set("page", String(state.page));
	const ai = state.ai.filter((column) => state.filters.some((filter) => filterColumn(filter) === column));
	if (ai.length) params.set("ai", ai.join(","));
	return params;
}

/**
 * The query `entries.query` and `entries.facets` take for this state. A collection with folders lists one folder at a time (doc 07). A translation
 * filter that names no languages asks about the ones the language filter picked, as the menu counts it (`entries.facets`), so a row's count is the
 * rows it leaves.
 */
export const toQuery = (collection: string, state: ListState, pageSize: number, folders = false) => ({
	collection,
	// "All folders" is a choice about what is looked for: with nothing looked for, a folder lists itself.
	...(folders
		? {
				folder: state.folder,
				scope: state.everywhere && state.search.text.trim() !== "" ? ("all" as const) : ("here" as const),
			}
		: {}),
	filters: state.filters.map((filter) => {
		const picked = state.filters.find((each) => each.on === "locale");
		return filter.on === "translation" && !filter.locales && picked?.on === "locale"
			? { ...filter, locales: picked.any }
			: filter;
	}),
	...(state.search.text.trim() ? { search: state.search } : {}),
	sort: state.sort,
	page: state.page,
	pageSize,
	timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/** The state with one column's filter replaced (or removed with `null`): back to the first page, and no longer the assistant's. */
export function withFilter(state: ListState, column: string, filter: ListFilter | null): ListState {
	return {
		...state,
		page: 1,
		ai: state.ai.filter((id) => id !== column),
		filters: [...state.filters.filter((each) => filterColumn(each) !== column), ...(filter ? [filter] : [])],
	};
}

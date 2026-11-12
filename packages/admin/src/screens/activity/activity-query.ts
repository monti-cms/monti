import {
	ACTIVITY_FILTERS,
	type ActivityFilter,
	type DateRange,
	DELIVERY_STATES,
	type DeliveryState,
} from "@monti-cms/core";

/** How many lines a page of the log holds: the trash's page. */
export const ACTIVITY_PAGE_SIZE = 50;

/** The kinds the log's first column filters by. Imports come with the import itself (doc 14): until then no line is one. */
export const ACTIVITY_KINDS_SHOWN = ACTIVITY_FILTERS.filter((kind) => kind !== "import");

/**
 * The activity log's place in its address (doc 13, flow 12), as every list keeps its own: what it is searched and filtered by, its order, its page
 * and the line open beside it. `asOf` is where this browsing stands (the first page's answer): the next pages carry it so they follow page 1 while
 * new activity arrives.
 */
export type ActivityState = {
	search: string;
	kinds: ActivityFilter[];
	deliveries: DeliveryState[];
	range: DateRange | null;
	/** Newest first, as it opens, or oldest first. */
	sort: "desc" | "asc";
	page: number;
	asOf: string | null;
	/**
	 * The page this one was reached from in the same browsing: its number, the places of its first and last lines, and the browsing's count. The
	 * server reads the page from there, so a line committed late does not make it repeat one, and the count under the list stays.
	 */
	from: { page: number; first: string; last: string; total: number } | null;
	/** The line open in the panel. */
	open: string | null;
};

const RANGE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;
/** `from` in the address: the page's number, its first and last lines' places and the count, dot between. */
const FROM = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
const among = <Value extends string>(known: readonly Value[], raw: string | null) =>
	(raw ?? "").split(",").filter((value): value is Value => (known as readonly string[]).includes(value));

/** Reads the address. What it does not know is left out, so an old link never breaks. */
export function readActivityState(params: URLSearchParams): ActivityState {
	const page = Number(params.get("page"));
	const date = params.get("date") ?? "";
	const span = RANGE.exec(date);
	const asOf = params.get("as");
	const from = FROM.exec(params.get("from") ?? "");
	const later = Number.isInteger(page) && page > 1;
	return {
		search: params.get("q") ?? "",
		kinds: among(ACTIVITY_KINDS_SHOWN, params.get("kind")),
		deliveries: among(DELIVERY_STATES, params.get("delivery")),
		range:
			date === "today" || date === "7d" || date === "30d"
				? date
				: span
					? { from: span[1] as string, to: span[2] as string }
					: null,
		sort: params.get("sort") === "asc" ? "asc" : "desc",
		page: Number.isInteger(page) && page > 1 ? page : 1,
		// Only a later page stands somewhere: a first page reads the log as it is now.
		asOf: asOf !== null && /^\d+$/.test(asOf) && later ? asOf : null,
		from:
			from && later && Number(from[1]) >= 1
				? { page: Number(from[1]), first: from[2] as string, last: from[3] as string, total: Number(from[4]) }
				: null,
		open: params.get("open"),
	};
}

/** The address of a state: only what differs from the log just opened. */
export function writeActivityState(state: ActivityState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.search) params.set("q", state.search);
	if (state.kinds.length > 0) params.set("kind", state.kinds.join(","));
	if (state.deliveries.length > 0) params.set("delivery", state.deliveries.join(","));
	if (state.range)
		params.set("date", typeof state.range === "string" ? state.range : `${state.range.from}..${state.range.to}`);
	if (state.sort === "asc") params.set("sort", "asc");
	if (state.page > 1) {
		params.set("page", String(state.page));
		if (state.asOf) params.set("as", state.asOf);
		if (state.from) params.set("from", `${state.from.page}.${state.from.first}.${state.from.last}.${state.from.total}`);
	}
	if (state.open) params.set("open", state.open);
	return params;
}

/** What `activity.list` (and `activity.facets`) is asked for this state. */
export const activityQueryOf = (state: ActivityState) => ({
	search: state.search,
	kinds: state.kinds,
	deliveries: state.deliveries,
	...(state.range ? { range: state.range } : {}),
	sort: state.sort,
	page: state.page,
	pageSize: ACTIVITY_PAGE_SIZE,
	...(state.asOf ? { asOf: state.asOf } : {}),
	...(state.from ? { from: state.from } : {}),
	timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

import type { TrashQuery, TrashRef } from "@monti-cms/core";

/** How many rows a page of the trash holds. */
export const TRASH_PAGE_SIZE = 50;

/** The trash's place in its address (flow 5): the thrown-away folder that is open, what it is searched and filtered by, and the row open in the panel. */
export type TrashState = {
	folder: string | null;
	search: string;
	/** A search inside a folder looks through the whole trash. */
	everywhere: boolean;
	/** Collections, and `media`. */
	kinds: string[];
	/** Languages: entries with one of them in the trash. */
	locales: string[];
	/** By the days left (the most left first, as it opens) or by title. */
	sort: TrashQuery["sort"];
	page: number;
	/** The item or the file open beside the list. */
	open: TrashRef | null;
};

const PANEL_KINDS = ["entry", "media"] as const;

/** Reads the address. What it does not know is left out, so an old link never breaks. */
export function readTrashState(params: URLSearchParams): TrashState {
	const page = Number(params.get("page"));
	const [kind, ...rest] = (params.get("open") ?? "").split(":");
	const panel = PANEL_KINDS.find((known) => known === kind);
	const id = rest.join(":");
	const dir = params.get("dir");
	return {
		folder: params.get("folder"),
		search: params.get("q") ?? "",
		everywhere: params.get("in") === "all",
		kinds: (params.get("kind") ?? "").split(",").filter(Boolean),
		locales: (params.get("lang") ?? "").split(",").filter(Boolean),
		sort: {
			by: params.get("sort") === "title" ? "title" : "left",
			// A title starts from A; the days left start from the most.
			dir: dir === "asc" || dir === "desc" ? dir : params.get("sort") === "title" ? "asc" : "desc",
		},
		page: Number.isInteger(page) && page > 1 ? page : 1,
		open: panel && id !== "" ? { kind: panel, id } : null,
	};
}

/** The address of a state: only what differs from the trash just opened. */
export function writeTrashState(state: TrashState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.folder) params.set("folder", state.folder);
	if (state.search) params.set("q", state.search);
	if (state.everywhere) params.set("in", "all");
	if (state.kinds.length > 0) params.set("kind", state.kinds.join(","));
	if (state.locales.length > 0) params.set("lang", state.locales.join(","));
	if (state.sort.by !== "left") params.set("sort", state.sort.by);
	if (state.sort.dir !== (state.sort.by === "title" ? "asc" : "desc")) params.set("dir", state.sort.dir);
	if (state.page > 1) params.set("page", String(state.page));
	if (state.open) params.set("open", `${state.open.kind}:${state.open.id}`);
	return params;
}

/** What `trash.list` is asked for this state. */
export const trashQueryOf = (state: TrashState) => ({
	...(state.folder ? { folder: state.folder } : {}),
	scope: state.everywhere && state.search.trim() !== "" ? ("all" as const) : ("here" as const),
	search: state.search,
	kinds: state.kinds,
	locales: state.locales,
	sort: state.sort,
	page: state.page,
	pageSize: TRASH_PAGE_SIZE,
});

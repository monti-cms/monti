import { type MediaKind, mediaSortStart } from "@monti-cms/core";

export const SORTS = ["uploaded", "name", "size"] as const;
export type Sort = (typeof SORTS)[number];
type Dir = "asc" | "desc";
export const USES = ["used", "unused"] as const;
type Use = (typeof USES)[number];
export const KINDS: readonly MediaKind[] = ["image", "file"];

/** The library's place in its address (flow 6): the open folder, what it is filtered by, how it shows, and the file open in the panel. */
export type MediaState = {
	folder: string | null;
	search: string;
	/** A search in a folder looks through the whole library (flow 6·15). */
	everywhere: boolean;
	kinds: MediaKind[];
	used: Use[];
	sort: Sort;
	dir: Dir;
	view: "grid" | "list";
	page: number;
	file: string | null;
};

const list = <Value extends string>(raw: string | null, known: readonly Value[]): Value[] =>
	(raw ?? "").split(",").filter((value): value is Value => (known as readonly string[]).includes(value));

/** Reads the address. Whatever an old link says that the library does not know is left out, so it never breaks. */
export function readMediaState(params: URLSearchParams): MediaState {
	const sort = SORTS.find((known) => known === params.get("sort")) ?? "uploaded";
	const dir = params.get("dir");
	const page = Number(params.get("page"));
	return {
		folder: params.get("folder"),
		search: params.get("q") ?? "",
		everywhere: params.get("in") === "all",
		kinds: list(params.get("kind"), KINDS),
		used: list(params.get("used"), USES),
		sort,
		dir: dir === "asc" || dir === "desc" ? dir : mediaSortStart(sort),
		view: params.get("view") === "list" ? "list" : "grid",
		page: Number.isInteger(page) && page > 1 ? page : 1,
		file: params.get("file"),
	};
}

/** The address of a state: only what differs from a library just opened. */
export function writeMediaState(state: MediaState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.folder) params.set("folder", state.folder);
	if (state.search) params.set("q", state.search);
	if (state.everywhere) params.set("in", "all");
	if (state.kinds.length > 0) params.set("kind", state.kinds.join(","));
	if (state.used.length > 0) params.set("used", state.used.join(","));
	if (state.sort !== "uploaded") params.set("sort", state.sort);
	if (state.dir !== mediaSortStart(state.sort)) params.set("dir", state.dir);
	if (state.view !== "grid") params.set("view", state.view);
	if (state.page > 1) params.set("page", String(state.page));
	if (state.file) params.set("file", state.file);
	return params;
}

/** What `media.query` is asked for this state. */
export const queryOf = (state: MediaState) => ({
	folder: state.folder,
	// "All folders" is the search box's choice: with no words looked for, a folder lists itself, filtered or not (2026-11-10, owner).
	scope: state.everywhere && state.search.trim() !== "" ? ("all" as const) : ("here" as const),
	search: state.search,
	kinds: state.kinds,
	used: state.used,
	sort: state.sort,
	dir: state.dir,
	page: state.page,
});

/**
 * Whether the screen is looking for files rather than sitting in a folder: by a search or a filter. Folders hide (components/list.md, 2026-11-09 owner).
 */
export const isLooking = (state: MediaState) => state.search !== "" || state.kinds.length > 0 || state.used.length > 0;

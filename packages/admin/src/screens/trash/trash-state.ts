import type { PageSize, TrashListParams } from "@monti-cms/core/site";
import { pageParam, pageSizeParam } from "../../lib/hooks/use-url-state";

/** The tab that shows every kind. */
export const ALL_KINDS = "all";

/**
 * What the trash screen keeps in its address, so Back restores it: the tab (a collection or `media`), the trashed folder looked into, the search, the
 * order of the day it was discarded, and the page.
 */
export interface TrashState {
	/** `all`, a collection, or `media`. */
	kind: string;
	/** The trashed folder that is open, or `null` at the top. */
	folder: string | null;
	/** The trashed folders it was reached through, the outermost first: where "up one folder" goes. */
	trail: string[];
	search: string;
	/** Newest first by default. */
	direction: "asc" | "desc";
	page: number;
	pageSize: PageSize;
}

export const DEFAULT_TRASH_STATE: TrashState = {
	kind: ALL_KINDS,
	folder: null,
	trail: [],
	search: "",
	direction: "desc",
	page: 1,
	pageSize: 25,
};

export function parseTrashState(params: URLSearchParams): TrashState {
	return {
		kind: params.get("kind") || ALL_KINDS,
		folder: params.get("folder") || null,
		trail: (params.get("trail") ?? "").split(",").filter(Boolean),
		search: params.get("search") ?? "",
		direction: params.get("sort") === "asc" ? "asc" : "desc",
		page: pageParam.parse(params.get("page")),
		pageSize: pageSizeParam.parse(params.get("pageSize")),
	};
}

/** The address query of a state; what equals the default is left out. */
export function trashStateToSearchParams(state: TrashState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.kind !== ALL_KINDS) params.set("kind", state.kind);
	if (state.folder) params.set("folder", state.folder);
	if (state.folder && state.trail.length > 0) params.set("trail", state.trail.join(","));
	if (state.search) params.set("search", state.search);
	if (state.direction === "asc") params.set("sort", "asc");
	if (state.page > 1) params.set("page", String(state.page));
	const size = pageSizeParam.serialize(state.pageSize);
	if (size) params.set("pageSize", size);
	return params;
}

/**
 * What `GET /trash` is asked. Inside a folder there are no tabs and no search (the head has neither), so only the folder is sent; at the top the tab and
 * the search are, and the search looks in the trashed folders too.
 */
export function trashStateToParams(state: TrashState): TrashListParams {
	return {
		...(state.folder
			? { folderId: state.folder }
			: {
					...(state.kind !== ALL_KINDS ? { kind: state.kind } : {}),
					...(state.search ? { search: state.search } : {}),
				}),
		direction: state.direction,
		page: state.page,
		pageSize: state.pageSize,
	};
}

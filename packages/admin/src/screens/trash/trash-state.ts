import type { PageSize, TrashListParams } from "@monti-cms/core/site";
import { pageParam, pageSizeParam } from "../../lib/hooks/use-url-state";

/**
 * What the trash screen keeps in its address, so Back restores it: the kinds the kind column filters to (collections or `media`), the trashed folder
 * looked into, the search, the order of the day it was discarded, and the page.
 */
export interface TrashState {
	/** Only these kinds (any of them); none is every kind. */
	kinds: string[];
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

export function parseTrashState(params: URLSearchParams): TrashState {
	return {
		kinds: params.getAll("kind").filter(Boolean),
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
	for (const kind of state.kinds) params.append("kind", kind);
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
 * What `GET /trash` is asked. Inside a folder there is no kind filter and no search (the head has neither), so only the folder is sent; at the top the
 * kinds and the search are, and the search looks in the trashed folders too.
 */
export function trashStateToParams(state: TrashState): TrashListParams {
	return {
		...(state.folder
			? { folderId: state.folder }
			: {
					...(state.kinds.length > 0 ? { kinds: state.kinds } : {}),
					...(state.search ? { search: state.search } : {}),
				}),
		direction: state.direction,
		page: state.page,
		pageSize: state.pageSize,
	};
}

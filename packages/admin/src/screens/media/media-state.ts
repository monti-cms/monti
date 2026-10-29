import type { Folder, PageSize } from "@monti-cms/core/site";
import { enumParam, pageParam, pageSizeParam, textParam } from "../../lib/hooks/use-url-state";

/** What the library keeps in its address, so a refresh keeps it and the address can be shared. The view (grid or list) is the person's own and lives in the browser. */
export const MEDIA_PARAMS = {
	page: pageParam,
	pageSize: pageSizeParam,
	search: textParam,
	used: enumParam(["all", "used", "unused"] as const, "all"),
	kind: enumParam(["all", "image", "file"] as const, "all"),
	alt: enumParam(["all", "none", "has"] as const, "all"),
	/** The order of the files: newest upload first, oldest first, by name, or biggest first. */
	sort: enumParam(["uploaded", "uploadedAsc", "name", "size"] as const, "uploaded"),
	/** Where a search or a filter looks while a folder is open: the folder and what is inside it, or everywhere. */
	scope: enumParam(["here", "all"] as const, "here"),
	/** The open folder's id; empty for the top of the library. */
	folder: textParam,
};

export interface MediaState {
	page: number;
	pageSize: PageSize;
	search: string;
	used: "all" | "used" | "unused";
	kind: "all" | "image" | "file";
	alt: "all" | "none" | "has";
	sort: "uploaded" | "uploadedAsc" | "name" | "size";
	scope: "here" | "all";
	folder: string;
}

/** Any word or condition is on. */
export const isFiltered = (state: Pick<MediaState, "search" | "used" | "kind" | "alt">): boolean =>
	state.search.trim() !== "" || state.used !== "all" || state.kind !== "all" || state.alt !== "all";

/**
 * The library searches below the open folder: words are typed, or the alt text condition is on. It then lists the files that match, in one list with
 * their paths, instead of the folder being looked into. The type and the use only narrow the files of the open folder, which stays browsable (its up row,
 * its folders and "+ Folder").
 */
export const isSearching = (state: Pick<MediaState, "search" | "alt">): boolean =>
	state.search.trim() !== "" || state.alt !== "all";

/** Whether the place to look can be chosen: only inside a folder, since the top already is everything. */
export const hasScope = (state: MediaState): boolean => isSearching(state) && state.folder !== "";

/**
 * The query of the list for this state. Looking into a folder asks for its files only (`folderId`; the top asks for the files in no folder), with the type
 * and the use narrowing them. A search asks for the open folder and what is inside it, or for everything when the place to look is widened.
 */
export function mediaListParams(state: MediaState): URLSearchParams {
	const params = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize) });
	if (state.used !== "all") params.set("used", state.used);
	if (state.search.trim()) params.set("search", state.search.trim());
	if (state.kind !== "all") params.set("kind", state.kind);
	if (state.alt !== "all") params.set("alt", state.alt);
	if (state.sort !== "uploaded") params.set("sort", state.sort);
	if (!isSearching(state)) {
		params.set("folderId", state.folder || "null");
	} else if (state.folder && state.scope === "here") {
		params.set("folderId", state.folder);
		params.set("includeDescendants", "true");
	}
	return params;
}

/**
 * The query of the counts the filter menus show: the same search words and usage, but not the type and alt text conditions. `direct` counts the open
 * folder's own files (what a type pick lists, since the type only narrows the folder); otherwise the place a search looks in (the alt text counts, since
 * that condition searches below).
 */
export function mediaCountsParams(state: MediaState, direct = false): URLSearchParams {
	const params = new URLSearchParams({ page: "1", pageSize: "1" });
	if (state.used !== "all") params.set("used", state.used);
	if (state.search.trim()) params.set("search", state.search.trim());
	if (direct) {
		params.set("folderId", state.folder || "null");
	} else if (state.folder && state.scope === "here") {
		params.set("folderId", state.folder);
		params.set("includeDescendants", "true");
	}
	return params;
}

/** The change a kind pick makes: the alt text condition only applies to pictures, so it goes when the kind is files. */
export const withKind = (kind: MediaState["kind"]): Partial<Pick<MediaState, "kind" | "alt">> =>
	kind === "file" ? { kind, alt: "all" } : { kind };

/** The kind after one of the two boxes of the kind menu was pressed: it is the box's kind alone, and pressing it again (or the other box too) means no condition. */
export function toggleKind(current: MediaState["kind"], pressed: "image" | "file"): MediaState["kind"] {
	return current === "all" ? pressed : "all";
}

/** The folders from the top down to `folderId` (the way back above the title), empty for the top. */
export function folderTrail(folders: readonly Folder[], folderId: string): Folder[] {
	const trail: Folder[] = [];
	const seen = new Set<string>();
	for (
		let at = folders.find((f) => f.id === folderId);
		at && !seen.has(at.id);
		at = folders.find((f) => f.id === at?.parentId)
	) {
		seen.add(at.id);
		trail.unshift(at);
	}
	return trail;
}

/**
 * Where a file is, written for the open folder: nothing for a file in it, the way down from it for a file in a folder inside it ("covers"), and the whole
 * path from the top for any other place ("Blog Assets / covers"); `none` for a file in no folder while a folder is open. A search or a filter lists files
 * from several folders, and this is what tells them apart without writing the shared start of every path.
 */
export function folderPathBelow(
	folders: readonly Folder[],
	openFolderId: string | null,
	fileFolderId: string | null | undefined,
	none: string,
): string | null {
	const file = fileFolderId || null;
	if (file === (openFolderId || null)) return null;
	if (!file) return none;
	const trail = folderTrail(folders, file);
	if (trail.length === 0) return none;
	const at = openFolderId ? trail.findIndex((folder) => folder.id === openFolderId) : -1;
	return trail
		.slice(at + 1)
		.map((folder) => folder.name)
		.join(" / ");
}

/** The folders a file can go to, in tree order (a folder, then what is inside it), each with how deep it is; the file's own folder is left out. */
export function folderChoices(
	folders: readonly Folder[],
	exclude: ReadonlySet<string | null> = new Set(),
): { folder: Folder; depth: number }[] {
	const out: { folder: Folder; depth: number }[] = [];
	const walk = (parentId: string | null, depth: number) => {
		for (const folder of folders
			.filter((f) => (f.parentId ?? null) === parentId)
			.sort((a, b) => a.position - b.position)) {
			if (!exclude.has(folder.id)) out.push({ folder, depth });
			walk(folder.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}

/** The pick's state for the select-all check: how many are picked of how many match. */
export const selectAllState = (picked: number, matching: number): "none" | "some" | "all" =>
	picked === 0 ? "none" : matching > 0 && picked >= matching ? "all" : "some";

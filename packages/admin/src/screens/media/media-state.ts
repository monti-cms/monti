import type { Folder } from "@monti-cms/core/site";
import { enumParam, pageParam, pageSizeParam, textParam } from "../../lib/hooks/use-url-state";

/** What the library keeps in its address, so a refresh keeps it and the address can be shared. The view (grid or list) is the person's own and lives in the browser. */
export const MEDIA_PARAMS = {
	page: pageParam,
	pageSize: pageSizeParam,
	search: textParam,
	used: enumParam(["all", "used", "unused"] as const, "all"),
	kind: enumParam(["all", "image", "file"] as const, "all"),
	alt: enumParam(["all", "none", "has"] as const, "all"),
	/** Where a search or a filter looks while a folder is open: the folder and what is inside it, or everywhere. */
	scope: enumParam(["here", "all"] as const, "here"),
	/** The open folder's id; empty for the top of the library. */
	folder: textParam,
};

export interface MediaState {
	page: number;
	pageSize: number;
	search: string;
	used: "all" | "used" | "unused";
	kind: "all" | "image" | "file";
	alt: "all" | "none" | "has";
	scope: "here" | "all";
	folder: string;
}

/** A search or a filter is on: the library shows the files that match, in one list with their paths, instead of the folder being looked into. */
export const isFiltered = (state: Pick<MediaState, "search" | "used" | "kind" | "alt">): boolean =>
	state.search.trim() !== "" || state.used !== "all" || state.kind !== "all" || state.alt !== "all";

/** Whether the place to look can be chosen: only inside a folder, since the top already is everything. */
export const hasScope = (state: MediaState): boolean => isFiltered(state) && state.folder !== "";

/**
 * The query of the list for this state. Looking into a folder asks for its files only (`folderId`; the top asks for the files in no folder). A search or a
 * filter asks for the open folder and what is inside it, or for everything when the place to look is widened.
 */
export function mediaListParams(state: MediaState): URLSearchParams {
	const params = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize) });
	if (state.used !== "all") params.set("used", state.used);
	if (state.search.trim()) params.set("search", state.search.trim());
	if (state.kind !== "all") params.set("kind", state.kind);
	if (state.alt !== "all") params.set("alt", state.alt);
	if (!isFiltered(state)) {
		params.set("folderId", state.folder || "null");
	} else if (state.folder && state.scope === "here") {
		params.set("folderId", state.folder);
		params.set("includeDescendants", "true");
	}
	return params;
}

/** The change a kind pick makes: the alt text condition only applies to pictures, so it goes when the kind is files. */
export const withKind = (kind: MediaState["kind"]): Partial<MediaState> =>
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

/** The path of a file's folder, "Blog Assets / covers"; `none` for a file in no folder. */
export function folderPathLabel(folders: readonly Folder[], folderId: string | null | undefined, none: string): string {
	if (!folderId) return none;
	const trail = folderTrail(folders, folderId);
	return trail.length > 0 ? trail.map((folder) => folder.name).join(" / ") : none;
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

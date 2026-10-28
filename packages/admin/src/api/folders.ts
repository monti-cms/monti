import type { FolderContents, FolderListItem, FolderTrashResult, Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** Query keys. Everything under `all` is refetched after a folder changes. */
export const foldersKeys = {
	all: ["cms", "folders"] as const,
	list: (collection: string) => [...foldersKeys.all, "list", collection] as const,
	contents: (id: string) => [...foldersKeys.all, "contents", id] as const,
};

/** The folders of a collection, each with the number of things directly in it (the list screen and the sidebar share this query). */
export const listFolders = (site: Site, collection: string, signal?: AbortSignal) =>
	adminFetch<FolderListItem[]>(site, `/v1/folders?${new URLSearchParams({ collection })}`, { signal });

/** What `id` holds, its subfolders included: how many entries are published and how many files are in use. Read before the folder goes to the trash. */
export const getFolderContents = (site: Site, id: string, signal?: AbortSignal) =>
	adminFetch<FolderContents>(site, `/v1/folders/${encodeURIComponent(id)}/contents`, { signal });

export const createFolder = (
	site: Site,
	input: { collection: string; name: string; parentId: string | null },
	fallback?: string,
) => adminFetch(site, "/v1/folders", { method: "POST", json: input, fallback });

/** Renames a folder (`name`) or moves it (`parentId`, `null` for the top level). */
export const updateFolder = (
	site: Site,
	id: string,
	input: { name: string; expectedVersion: number } | { parentId: string | null; expectedVersion: number },
	fallback?: string,
) => adminFetch(site, `/v1/folders/${encodeURIComponent(id)}`, { method: "PATCH", json: input, fallback });

/**
 * `DELETE /v1/folders/:id`: moves the folder, its subfolders and its entries to the trash as one unit. A media folder that holds files in use stays,
 * and only its other files go (`folder` is `null` then).
 */
export const deleteFolder = (site: Site, id: string, expectedVersion: number, fallback?: string) =>
	adminFetch<FolderTrashResult>(
		site,
		`/v1/folders/${encodeURIComponent(id)}?${new URLSearchParams({ expectedVersion: String(expectedVersion) })}`,
		{
			method: "DELETE",
			fallback,
		},
	);

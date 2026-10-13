import { cmsApiUrl, type Site } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { cmsFetch } from "./client";

/** What deleting a folder moves up to its parent: the entries and child folders directly inside. */
export interface FolderContents {
	entryCount: number;
	childFolders: Folder[];
}

/** Query keys. Everything under `all` is refetched after a folder changes. */
export const foldersKeys = {
	all: ["cms", "folders"] as const,
	list: (collection: string) => [...foldersKeys.all, "list", collection] as const,
	contents: (id: string) => [...foldersKeys.all, "contents", id] as const,
};

/** The folders of a collection (the list screen and the sidebar share this query). */
export const listFolders = (site: Site, collection: string, signal?: AbortSignal) =>
	cmsFetch<Folder[]>(site, cmsApiUrl(`/v1/folders?${new URLSearchParams({ collection })}`), { signal });

/** What deleting `id` would move to the parent folder. */
export const getFolderContents = (site: Site, id: string, signal?: AbortSignal) =>
	cmsFetch<FolderContents>(site, cmsApiUrl(`/v1/folders/${encodeURIComponent(id)}`), { signal });

export const createFolder = (
	site: Site,
	input: { collection: string; name: string; parentId: string | null },
	fallback?: string,
) => cmsFetch(site, cmsApiUrl("/v1/folders"), { method: "POST", json: input, fallback });

/** Renames a folder (`name`) or moves it (`parentId`, `null` for the top level). */
export const updateFolder = (
	site: Site,
	id: string,
	input: { name: string; expectedVersion: number } | { parentId: string | null; expectedVersion: number },
	fallback?: string,
) => cmsFetch(site, cmsApiUrl(`/v1/folders/${encodeURIComponent(id)}`), { method: "PATCH", json: input, fallback });

export const deleteFolder = (site: Site, id: string, expectedVersion: number, fallback?: string) =>
	cmsFetch(
		site,
		cmsApiUrl(
			`/v1/folders/${encodeURIComponent(id)}?${new URLSearchParams({ expectedVersion: String(expectedVersion) })}`,
		),
		{
			method: "DELETE",
			fallback,
		},
	);

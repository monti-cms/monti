import { adminFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a folder changes. */
export const foldersKeys = {
    all: ["cms", "folders"],
    list: (collection) => [...foldersKeys.all, "list", collection],
    contents: (id) => [...foldersKeys.all, "contents", id],
};
/** The folders of a collection (the list screen and the sidebar share this query). */
export const listFolders = (site, collection, signal) => adminFetch(site, `/v1/folders?${new URLSearchParams({ collection })}`, { signal });
/** What deleting `id` would move to the parent folder. */
export const getFolderContents = (site, id, signal) => adminFetch(site, `/v1/folders/${encodeURIComponent(id)}`, { signal });
export const createFolder = (site, input, fallback) => adminFetch(site, "/v1/folders", { method: "POST", json: input, fallback });
/** Renames a folder (`name`) or moves it (`parentId`, `null` for the top level). */
export const updateFolder = (site, id, input, fallback) => adminFetch(site, `/v1/folders/${encodeURIComponent(id)}`, { method: "PATCH", json: input, fallback });
export const deleteFolder = (site, id, expectedVersion, fallback) => adminFetch(site, `/v1/folders/${encodeURIComponent(id)}?${new URLSearchParams({ expectedVersion: String(expectedVersion) })}`, {
    method: "DELETE",
    fallback,
});

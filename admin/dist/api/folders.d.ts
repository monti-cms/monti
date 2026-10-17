import type { Folder, Site } from "@monti-cms/core/site";
/** What deleting a folder moves up to its parent: the entries and child folders directly inside. */
export interface FolderContents {
    entryCount: number;
    childFolders: Folder[];
}
/** Query keys. Everything under `all` is refetched after a folder changes. */
export declare const foldersKeys: {
    all: readonly ["cms", "folders"];
    list: (collection: string) => readonly ["cms", "folders", "list", string];
    contents: (id: string) => readonly ["cms", "folders", "contents", string];
};
/** The folders of a collection (the list screen and the sidebar share this query). */
export declare const listFolders: (site: Site, collection: string, signal?: AbortSignal) => Promise<Folder[]>;
/** What deleting `id` would move to the parent folder. */
export declare const getFolderContents: (site: Site, id: string, signal?: AbortSignal) => Promise<FolderContents>;
export declare const createFolder: (site: Site, input: {
    collection: string;
    name: string;
    parentId: string | null;
}, fallback?: string) => Promise<unknown>;
/** Renames a folder (`name`) or moves it (`parentId`, `null` for the top level). */
export declare const updateFolder: (site: Site, id: string, input: {
    name: string;
    expectedVersion: number;
} | {
    parentId: string | null;
    expectedVersion: number;
}, fallback?: string) => Promise<unknown>;
export declare const deleteFolder: (site: Site, id: string, expectedVersion: number, fallback?: string) => Promise<unknown>;

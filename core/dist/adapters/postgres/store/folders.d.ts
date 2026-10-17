import { type FolderSite } from "../../../core/domain/folders.js";
import type { Folder } from "../../../core/store/types.js";
import type { Db } from "../db/kysely.js";
import { type StoreContext } from "./context.js";
/**
 * Checks that something of `collection` (an entry, or a media file with `"media"`) can be put in `folderId`: the collection uses folders and the folder
 * belongs to it. No folder (`null`, the top level) is always allowed.
 */
export declare function assertFolderTarget(db: Db, site: FolderSite, folderId: string | null | undefined, collection: string): Promise<void>;
/** Per-collection virtual folders. An admin-only grouping unrelated to entry slugs, tags, or categories. */
export declare function createFolderOps(ctx: StoreContext): {
    createFolder: (params: {
        collection: string;
        parentId: string | null;
        name: string;
        position?: number;
    }) => Promise<Folder>;
    /** The HTTP layer always requires `expectedVersion`. The store compares it only when given. */
    updateFolder: (params: {
        id: string;
        expectedVersion?: number;
        name?: string;
        parentId?: string | null;
        position?: number;
    }) => Promise<Folder>;
    /**
     * Deletes a folder. Moves its direct entries and child folders up to the parent. Entries are not deleted.
     * If a moved child folder's name collides in the parent, rejects with 409 so the user renames first.
     */
    deleteFolder: (params: {
        id: string;
        expectedVersion?: number;
    }) => Promise<void>;
    /** Preview before folder deletion: the number of direct entries and child folders. */
    getFolderContents: (params: {
        id: string;
    }) => Promise<{
        entryCount: number;
        childFolders: Folder[];
    }>;
    listFolders: (params: {
        collection: string;
    }) => Promise<Folder[]>;
};

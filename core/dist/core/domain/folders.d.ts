/**
 * Folder rules. A folder belongs to one collection, and so does everything put in it. Folders nest, but never in a loop. Only a collection that uses
 * folders (`site.foldersEnabled`) has them: every folder write and every move into a folder checks it, whichever way it comes in.
 */
/** What the folder rules need from the site: whether a collection uses folders. */
export interface FolderSite {
    foldersEnabled(collection: string): boolean;
}
/**
 * A collection without folders (`folders: false` in its schema, the default for item collections) has none: no folder is created, read, changed or
 * deleted in it, and nothing is moved into one. Moving an entry out of a folder (to the top level) stays allowed.
 */
export declare function assertFoldersEnabled(site: FolderSite, collection: string): void;
/** The folder an entry is put in must belong to the entry's collection. `folderCollection` is `undefined` when the folder does not exist. */
export declare function assertFolderInCollection(folderCollection: string | undefined, collection: string): void;
/** A parent folder must belong to the same collection as the folder under it. */
export declare function assertParentInCollection(parentCollection: string | undefined, collection: string): void;
/** Moving a folder under one of its own descendants (or under itself) would make a loop. `ancestorIds` are the new parent and its ancestors. */
export declare function assertNoFolderCycle(folderId: string, ancestorIds: readonly string[]): void;

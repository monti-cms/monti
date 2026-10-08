/**
 * Folder rules. A folder belongs to one collection, and so does everything put in it. Folders nest, but never in a loop.
 */
/** The folder an entry is put in must belong to the entry's collection. `folderCollection` is `undefined` when the folder does not exist. */
export declare function assertFolderInCollection(folderCollection: string | undefined, collection: string): void;
/** A parent folder must belong to the same collection as the folder under it. */
export declare function assertParentInCollection(parentCollection: string | undefined, collection: string): void;
/** Moving a folder under one of its own descendants (or under itself) would make a loop. `ancestorIds` are the new parent and its ancestors. */
export declare function assertNoFolderCycle(folderId: string, ancestorIds: readonly string[]): void;

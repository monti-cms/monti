import { CmsError } from "../store/errors.js";
/**
 * Folder rules. A folder belongs to one collection, and so does everything put in it. Folders nest, but never in a loop.
 */
/** The folder an entry is put in must belong to the entry's collection. `folderCollection` is `undefined` when the folder does not exist. */
export function assertFolderInCollection(folderCollection, collection) {
    if (folderCollection !== collection)
        throw new CmsError("Invalid folder", "invalid_input");
}
/** A parent folder must belong to the same collection as the folder under it. */
export function assertParentInCollection(parentCollection, collection) {
    if (parentCollection !== collection)
        throw new CmsError("Invalid parent", "invalid_input");
}
/** Moving a folder under one of its own descendants (or under itself) would make a loop. `ancestorIds` are the new parent and its ancestors. */
export function assertNoFolderCycle(folderId, ancestorIds) {
    if (ancestorIds.includes(folderId))
        throw new CmsError("Cycle", "invalid_input");
}

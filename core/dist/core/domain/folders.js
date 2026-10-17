import { CmsError } from "../store/errors.js";
/**
 * A collection without folders (`folders: false` in its schema, the default for item collections) has none: no folder is created, read, changed or
 * deleted in it, and nothing is moved into one. Moving an entry out of a folder (to the top level) stays allowed.
 */
export function assertFoldersEnabled(site, collection) {
    if (!site.foldersEnabled(collection)) {
        throw new CmsError(`The collection "${collection}" does not use folders. Set \`folders: true\` on it in the schema to use them.`, "invalid_input");
    }
}
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
    if (ancestorIds.includes(folderId)) {
        throw new CmsError("Cycle", "invalid_input", { notice: { key: "folder.cycle" } });
    }
}

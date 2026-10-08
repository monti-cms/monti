import { CmsError } from "../store/errors.js";
const ALLOWED_FROM = {
    archive: ["draft", "published"],
    unarchive: ["archived"],
    trash: ["draft", "published", "archived"],
    restore: ["trashed"],
};
/** Status after the transition. A restored publish-collection entry returns to draft. */
export const STATUS_AFTER = {
    archive: "archived",
    unarchive: "draft",
    trash: "trashed",
    restore: "draft",
};
export function assertTransitionAllowed(action, status, version) {
    if (!ALLOWED_FROM[action].includes(status)) {
        throw new CmsError(`Cannot change status from ${status}`, "invalid_status", version);
    }
}
/** Record collections (tags, categories, ...) have no archive. */
export function assertArchivable(site, collection, version) {
    if (site.isItemCollection(collection)) {
        throw new CmsError("Record collections cannot be archived", "invalid_status", version);
    }
}
/** A record in use must have its references released before it goes to the trash. */
export const trashRequiresNoReferences = (site, collection) => site.isItemCollection(collection);
/** A record collection is published again on restore (with its prepared draft); a content collection returns to draft. */
export const restorePublishesAgain = (site, collection) => site.isItemCollection(collection);
/** Restoring a translation while its source is in the trash would leave it out of the list (one row per source) without shared values. */
export function assertSourceNotTrashed(sourceStatus, version) {
    if (sourceStatus === "trashed")
        throw new CmsError("Restore the source first", "source_trashed", version);
}
/** A record's prepared draft is required to publish it again on restore. */
export function assertRestoreSnapshot(snapshot) {
    if (!snapshot)
        throw new CmsError("Restoring a record needs its prepared draft", "invalid_input");
}
/** Only a trashed entry can be deleted for good. */
export function assertDeletable(status, version) {
    if (status !== "trashed") {
        throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status", version);
    }
}
const idsOf = (members) => members.map((member) => member.id);
/** The translations a source's transition applies to. A transition applies to the whole group. */
export function membersToArchive(members) {
    return idsOf(members.filter((member) => member.status === "draft" || member.status === "published"));
}
export function membersToUnarchive(members) {
    return idsOf(members.filter((member) => member.status === "archived"));
}
export function membersToTrash(members) {
    return idsOf(members.filter((member) => member.status !== "trashed"));
}
/** Only translations trashed together with the source (the same trash time) come back. Translations trashed separately stay in the trash. */
export function membersToRestore(members, sourceTrashedAt) {
    if (!sourceTrashedAt)
        return [];
    return idsOf(members.filter((member) => member.status === "trashed" && member.trashedAt?.getTime() === sourceTrashedAt.getTime()));
}
/**
 * Deleting a source deletes its translations too, so a translation outside the trash blocks it (it would lose its shared values).
 * Returns the blocking translations' IDs, empty when the delete may go on.
 */
export function blockingTranslations(members) {
    return idsOf(members.filter((member) => member.status !== "trashed"));
}

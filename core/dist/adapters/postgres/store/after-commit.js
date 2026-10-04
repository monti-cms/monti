const changeOf = (kind, entry) => ({
    kind,
    entryId: entry.id,
    collection: entry.collection,
    locale: entry.locale,
    translationGroupId: entry.translationGroupId,
    status: entry.status,
    publishedSlug: entry.publishedSlug,
    workingSlug: entry.workingSlug,
});
/** Changes that return an entry, and their notification kinds. */
const ENTRY_CHANGES = {
    createEntryWithReferences: "created",
    duplicateEntry: "created",
    saveWorkingWithReferences: "saved",
    publishEntry: "published",
    archiveEntry: "archived",
    unarchiveEntry: "unarchived",
    trashEntry: "trashed",
    restoreEntry: "restored",
};
/**
 * Wraps the store's mutation functions so `afterCommit` is called after the commit. If the notification fails, the committed change stays
 * and the request does not fail (the error is only logged).
 */
export function withAfterCommit(store, afterCommit) {
    const notify = async (change) => {
        try {
            await afterCommit(change);
        }
        catch (error) {
            console.error("[cms] afterCommit failed", change.kind, change.entryId, error);
        }
    };
    const wrapped = { ...store };
    for (const [method, kind] of Object.entries(ENTRY_CHANGES)) {
        const original = store[method];
        if (typeof original !== "function")
            continue;
        wrapped[method] = async (...args) => {
            const entry = (await original.apply(store, args));
            await notify(changeOf(kind, entry));
            return entry;
        };
    }
    wrapped.permanentDeleteEntry = async (params) => {
        const before = await store.getEntry(params.id).catch(() => null);
        await store.permanentDeleteEntry(params);
        if (before)
            await notify(changeOf("deleted", before));
    };
    return wrapped;
}

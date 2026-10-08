/** Changes that return an entry, and their notification kinds. */
const ENTRY_CHANGES = {
    createEntryWithReferences: "created",
    saveWorkingWithReferences: "saved",
    publishEntry: "published",
    archiveEntry: "archived",
    unarchiveEntry: "unarchived",
    trashEntry: "trashed",
    restoreEntry: "restored",
};
/**
 * Wraps the store's mutation functions so `dispatch` is called with the entry id after each commit. The store has already written the events of the change
 * in its own transaction (the outbox), so `dispatch` only delivers them. If it throws, the committed change stays and the request does not fail (the
 * error is logged), and the undelivered events are found by the next retry.
 */
export function withEventDispatch(store, dispatch) {
    const notify = async (entryId) => {
        try {
            await dispatch(entryId);
        }
        catch (error) {
            console.error("[cms] event delivery failed", entryId, error);
        }
    };
    // A proxy, not a copy: the store may itself be a proxy that answers any name (the lazy adapter store), which a spread would not see.
    const overrides = new Map();
    for (const method of Object.keys(ENTRY_CHANGES)) {
        const original = store[method];
        if (typeof original !== "function")
            continue;
        overrides.set(method, async (...args) => {
            const entry = (await original.apply(store, args));
            await notify(entry.id);
            return entry;
        });
    }
    const deleteEntry = store.permanentDeleteEntry;
    if (typeof deleteEntry === "function") {
        overrides.set("permanentDeleteEntry", async (params) => {
            await deleteEntry.call(store, params);
            await notify(params.id);
        });
    }
    return new Proxy(store, {
        get: (target, name) => (overrides.has(name) ? overrides.get(name) : Reflect.get(target, name)),
    });
}

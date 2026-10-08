/**
 * What the plugin remembers, in its own plugin storage (`cms.storage("git-sync")`): per entry the file it was last synced to, the queue of publishes waiting for
 * their commit, the conflicts waiting for a decision, and a lock per target. Nothing here is the entry itself: the CMS database and the repo are the two sides.
 */
/** The collections of the plugin's storage. */
export const COLLECTIONS = {
    settings: "settings",
    records: "records",
    queue: "queue",
    conflicts: "conflicts",
    status: "status",
    locks: "locks",
    applying: "applying",
};
const isConflict = (error) => error?.code === "conflict";
const isNotFound = (error) => error?.code === "not_found";
/** Writes an item whatever its stored version is (last write wins). Retries when another writer got in between. */
async function upsert(collection, key, value) {
    for (let attempt = 0;; attempt += 1) {
        const current = await collection.get(key);
        try {
            return await collection.set(key, value, { expectedVersion: current?.version ?? 0 });
        }
        catch (error) {
            if (!isConflict(error) || attempt >= 4)
                throw error;
        }
    }
}
/** Deletes an item if it is there. */
async function removeItem(collection, key) {
    const current = await collection.get(key);
    if (!current)
        return;
    try {
        await collection.delete(key, { expectedVersion: current.version });
    }
    catch (error) {
        if (!isNotFound(error) && !isConflict(error))
            throw error;
    }
}
export const entryKey = (target, entryId) => `${target}:${entryId}`;
/** The key of a conflict: one per entry per target. */
export const conflictKey = entryKey;
const prefixOf = (target) => `${target}:`;
/** Typed access to the plugin's storage. */
export function createState(storage) {
    const settings = storage.collection(COLLECTIONS.settings);
    const records = storage.collection(COLLECTIONS.records);
    const queue = storage.collection(COLLECTIONS.queue);
    const conflicts = storage.collection(COLLECTIONS.conflicts);
    const status = storage.collection(COLLECTIONS.status);
    const locks = storage.collection(COLLECTIONS.locks);
    const applying = storage.collection(COLLECTIONS.applying);
    return {
        settings: {
            get: () => settings.get("default"),
            save: (value, expectedVersion) => settings.set("default", value, { expectedVersion }),
        },
        records: {
            get: async (target, entryId) => (await records.get(entryKey(target, entryId)))?.value ?? null,
            /** Every record of a target, by entry id. */
            list: async (target) => new Map((await records.list({ prefix: prefixOf(target) })).map((item) => [item.value.entryId, item.value])),
            put: (record) => upsert(records, entryKey(record.target, record.entryId), record),
            remove: (target, entryId) => removeItem(records, entryKey(target, entryId)),
        },
        queue: {
            list: async (target) => (await queue.list(target ? { prefix: prefixOf(target) } : undefined)).map((item) => ({
                item: item.value,
                version: item.version,
            })),
            put: (item) => upsert(queue, entryKey(item.target, item.entryId), item),
            get: async (target, entryId) => queue.get(entryKey(target, entryId)),
            /** Removes an item only if it was not queued again since it was read (its version is the one given). */
            removeIfUnchanged: async (target, entryId, version) => {
                try {
                    await queue.delete(entryKey(target, entryId), { expectedVersion: version });
                }
                catch (error) {
                    if (!isNotFound(error) && !isConflict(error))
                        throw error;
                }
            },
            remove: (target, entryId) => removeItem(queue, entryKey(target, entryId)),
        },
        conflicts: {
            list: async (target) => (await conflicts.list(target ? { prefix: prefixOf(target) } : undefined)).map((item) => item.value),
            get: async (target, entryId) => (await conflicts.get(conflictKey(target, entryId)))?.value ?? null,
            put: (conflict) => upsert(conflicts, conflict.id, conflict),
            remove: (target, entryId) => removeItem(conflicts, conflictKey(target, entryId)),
        },
        status: {
            get: async (target) => (await status.get(target))?.value ?? {},
            /** Merges values into the target's status. */
            patch: async (target, values) => {
                await upsert(status, target, { ...((await status.get(target))?.value ?? {}), ...values });
            },
        },
        locks: {
            get: async (target) => (await locks.get(target)) ?? null,
            /** Takes the lock when there is none, or when it has expired. `false` when someone holds it. */
            tryAcquire: async (target, holder, ttlMs, now) => {
                const current = await locks.get(target);
                if (current && current.value.expiresAt > now)
                    return false;
                try {
                    await locks.set(target, { holder, expiresAt: now + ttlMs }, { expectedVersion: current?.version ?? 0 });
                    return true;
                }
                catch (error) {
                    if (isConflict(error))
                        return false;
                    throw error;
                }
            },
            release: async (target, holder) => {
                const current = await locks.get(target);
                if (current?.value.holder !== holder)
                    return;
                try {
                    await locks.delete(target, { expectedVersion: current.version });
                }
                catch (error) {
                    if (!isNotFound(error) && !isConflict(error))
                        throw error;
                }
            },
        },
        /** Marks a path as being written by an import, so the publish that import causes is not pushed back. */
        applying: {
            mark: (target, path, now) => upsert(applying, entryKey(target, path), { at: now }),
            isMarked: async (target, path, now, windowMs) => {
                const item = await applying.get(entryKey(target, path));
                return item !== null && now - item.value.at < windowMs;
            },
            clear: (target, path) => removeItem(applying, entryKey(target, path)),
        },
    };
}

import { storageNamespace } from "../../lib/utils/site-storage.js";
/**
 * Browser recovery copy. Keeps the latest in-progress input in IndexedDB.
 *
 * - The key is `admin ID:content ID` (`admin ID:new:collection` for a new post), so it never mixes with another account's recovery copy.
 * - Each site has a database of its own (`cms_backup:<site name><admin path>`), so two sites served from one origin keep their copies apart.
 * - Copies written before that live in the `cms_backup` database. A copy found there is moved to the site's own database the first time it is read, and it is
 *   deleted from there with the rest of the copy's life (a discard removes both). Their keys hold an entry ID, which is unique across sites, so moving one copy
 *   never takes another site's.
 * - If saving fails (private browsing mode, storage quota denied, etc.), it returns `false` so the screen reports exactly that recovery is unavailable.
 * - The snapshot is the entry form, which holds the body as `doc` (a stored document). Copies written before that hold it as MDX text in `mdx`; they are upgraded when they
 *   are read (`legacy-backup.ts`), so what is stored here is never rewritten in place.
 */
/** The database that held every site's copies before they were kept per site. Only read from and cleared, never written. */
export const LEGACY_DB_NAME = "cms_backup";
const STORE_NAME = "backups";
const DB_VERSION = 1;
/** The name of a site's recovery database. */
export const backupDatabaseName = (site) => `${LEGACY_DB_NAME}:${storageNamespace(site)}`;
export const backupKey = (adminId, entryId, collection) => entryId ? `${adminId}:${entryId}` : `${adminId}:new:${collection}`;
/** Opens a recovery DB, creating it if it does not exist. */
function openDB(name) {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB not available"));
            return;
        }
        const request = window.indexedDB.open(name, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME))
                db.createObjectStore(STORE_NAME, { keyPath: "key" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function run(name, mode, action) {
    const db = await openDB(name);
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const request = action(tx.objectStore(STORE_NAME));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    finally {
        // A connection left open would block a later upgrade or deletion of the database.
        db.close();
    }
}
/**
 * Whether the old shared database exists. Opening a database creates it, and a site that never had one has no reason to get an empty one, so it is looked up
 * first where the browser can list databases; where it cannot, it is simply opened.
 */
async function legacyDatabaseExists() {
    try {
        const list = await window.indexedDB.databases?.();
        return list === undefined ? true : list.some((database) => database.name === LEGACY_DB_NAME);
    }
    catch {
        return true;
    }
}
/** Stores a recovery copy in the site's database. Returns `false` on failure. */
export async function saveLocalBackup(record, site) {
    try {
        await run(backupDatabaseName(site), "readwrite", (store) => store.put(record));
        return true;
    }
    catch {
        return false;
    }
}
/**
 * The recovery copy under `key`: the site's own, else one the old shared database holds, which is moved to the site's database on the way (kept where it was if it
 * cannot be moved, so it is found again next time).
 */
export async function getLocalBackup(key, site) {
    try {
        const own = (await run(backupDatabaseName(site), "readonly", (store) => store.get(key)));
        if (own)
            return own;
        if (!(await legacyDatabaseExists()))
            return null;
        const old = (await run(LEGACY_DB_NAME, "readonly", (store) => store.get(key)));
        if (!old)
            return null;
        if (await saveLocalBackup(old, site)) {
            await run(LEGACY_DB_NAME, "readwrite", (store) => store.delete(key)).catch(() => undefined);
        }
        return old;
    }
    catch {
        return null;
    }
}
/** Deletes the recovery copy under `key` from the site's database and from the old shared one, so a discarded copy is not found again there. */
export async function deleteLocalBackup(key, site) {
    try {
        await run(backupDatabaseName(site), "readwrite", (store) => store.delete(key));
    }
    catch {
        // A recovery copy that could not be deleted is deleted again next time it is opened if it matches the server.
    }
    try {
        if (await legacyDatabaseExists())
            await run(LEGACY_DB_NAME, "readwrite", (store) => store.delete(key));
    }
    catch {
        // Same as above.
    }
}

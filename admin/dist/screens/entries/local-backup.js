import { storageNamespace } from "../../lib/utils/site-storage.js";
/**
 * Browser recovery copy. Keeps the latest in-progress input in IndexedDB.
 *
 * - The key is `admin ID:content ID` (`admin ID:new:collection` for a new post), so it never mixes with another account's recovery copy.
 * - Each site has a database of its own (`cms_backup:<site name><admin path>`), so two sites served from one origin keep their copies apart.
 * - If saving fails (private browsing mode, storage quota denied, etc.), it returns `false` so the screen reports exactly that recovery is unavailable.
 * - The snapshot is the entry form, which holds the body as `doc` (a stored document).
 */
const DB_NAME_PREFIX = "cms_backup";
const STORE_NAME = "backups";
const DB_VERSION = 1;
/** The name of a site's recovery database. */
export const backupDatabaseName = (site) => `${DB_NAME_PREFIX}:${storageNamespace(site)}`;
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
/** The recovery copy under `key` in the site's database, or `null` (also when the browser has no IndexedDB). */
export async function getLocalBackup(key, site) {
    try {
        const own = (await run(backupDatabaseName(site), "readonly", (store) => store.get(key)));
        return own ?? null;
    }
    catch {
        return null;
    }
}
/** Deletes the recovery copy under `key` from the site's database. */
export async function deleteLocalBackup(key, site) {
    try {
        await run(backupDatabaseName(site), "readwrite", (store) => store.delete(key));
    }
    catch {
        // A recovery copy that could not be deleted is deleted again next time it is opened if it matches the server.
    }
}

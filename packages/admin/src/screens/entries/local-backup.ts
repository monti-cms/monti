/**
 * Browser recovery copy. Keeps the latest in-progress input in IndexedDB.
 *
 * - The key is `admin ID:content ID` (`admin ID:new:collection` for a new post), so it never mixes with another account's recovery copy.
 * - If saving fails (private browsing mode, storage quota denied, etc.), it returns `false` so the screen reports exactly that recovery is unavailable.
 */

/** Recovery DB name. IndexedDB is separate per site address (origin), so the site name is not appended. */
const DB_NAME = "cms_backup";
const STORE_NAME = "backups";
const DB_VERSION = 1;

export interface LocalBackupRecord<Snapshot = Record<string, unknown>> {
	key: string;
	entryId: string;
	/** Server version the recovery copy was based on. */
	baseVersion: number;
	baseFingerprint: string;
	localFingerprint: string;
	snapshot: Snapshot;
	changeSeq: number;
	savedAt: number;
}

export const backupKey = (adminId: string, entryId: string | null, collection: string) =>
	entryId ? `${adminId}:${entryId}` : `${adminId}:new:${collection}`;

/** Opens the recovery DB, creating it if it does not exist. */
function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined" || !window.indexedDB) {
			reject(new Error("IndexedDB not available"));
			return;
		}
		const request = window.indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await openDB();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const request = action(tx.objectStore(STORE_NAME));
		tx.oncomplete = () => resolve(request.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

/** Stores a recovery copy. Returns `false` on failure. */
export async function saveLocalBackup(record: LocalBackupRecord): Promise<boolean> {
	try {
		await run("readwrite", (store) => store.put(record));
		return true;
	} catch {
		return false;
	}
}

export async function getLocalBackup<Snapshot = Record<string, unknown>>(
	key: string,
): Promise<LocalBackupRecord<Snapshot> | null> {
	try {
		const record = (await run("readonly", (store) => store.get(key))) as LocalBackupRecord<Snapshot> | undefined;
		return record ?? null;
	} catch {
		return null;
	}
}

export async function deleteLocalBackup(key: string): Promise<void> {
	try {
		await run("readwrite", (store) => store.delete(key));
	} catch {
		// A recovery copy that could not be deleted is deleted again next time it is opened if it matches the server.
	}
}

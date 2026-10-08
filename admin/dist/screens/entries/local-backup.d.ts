import type { Site } from "@monti-cms/core/client";
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
export declare const LEGACY_DB_NAME = "cms_backup";
/** The name of a site's recovery database. */
export declare const backupDatabaseName: (site: Site) => string;
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
export declare const backupKey: (adminId: string, entryId: string | null, collection: string) => string;
/** Stores a recovery copy in the site's database. Returns `false` on failure. */
export declare function saveLocalBackup(record: LocalBackupRecord, site: Site): Promise<boolean>;
/**
 * The recovery copy under `key`: the site's own, else one the old shared database holds, which is moved to the site's database on the way (kept where it was if it
 * cannot be moved, so it is found again next time).
 */
export declare function getLocalBackup<Snapshot = Record<string, unknown>>(key: string, site: Site): Promise<LocalBackupRecord<Snapshot> | null>;
/** Deletes the recovery copy under `key` from the site's database and from the old shared one, so a discarded copy is not found again there. */
export declare function deleteLocalBackup(key: string, site: Site): Promise<void>;

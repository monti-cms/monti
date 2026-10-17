import type { Site } from "@monti-cms/core/site";
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
/** The recovery copy under `key` in the site's database, or `null` (also when the browser has no IndexedDB). */
export declare function getLocalBackup<Snapshot = Record<string, unknown>>(key: string, site: Site): Promise<LocalBackupRecord<Snapshot> | null>;
/** Deletes the recovery copy under `key` from the site's database. */
export declare function deleteLocalBackup(key: string, site: Site): Promise<void>;

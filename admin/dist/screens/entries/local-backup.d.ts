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
/** Stores a recovery copy. Returns `false` on failure. */
export declare function saveLocalBackup(record: LocalBackupRecord): Promise<boolean>;
export declare function getLocalBackup<Snapshot = Record<string, unknown>>(key: string): Promise<LocalBackupRecord<Snapshot> | null>;
export declare function deleteLocalBackup(key: string): Promise<void>;

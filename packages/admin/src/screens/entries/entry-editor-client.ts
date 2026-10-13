import type { Site } from "@monti-cms/core/client";
import type { EntryForm } from "./entry-form";
import { deleteLocalBackup, getLocalBackup, type LocalBackupRecord, saveLocalBackup } from "./local-backup";

/** What the browser keeps of an unsaved edit: one record per entry (or per new entry of a collection). */
export type RecoveryRecord = LocalBackupRecord<EntryForm>;

/**
 * Where the recovery copy lives. The default is the browser's IndexedDB (`local-backup.ts`). `put` resolves `false` when the copy could not
 * be kept (private browsing, storage quota), so the editor can tell the user that recovery is unavailable.
 *
 * @experimental
 */
export interface RecoveryStore {
	get(key: string): Promise<RecoveryRecord | null>;
	put(record: RecoveryRecord): Promise<boolean>;
	delete(key: string): Promise<void>;
}

/**
 * The browser's IndexedDB, in a database of the site's own (two sites on one origin keep their copies apart).
 *
 * @experimental
 */
export const localRecoveryStoreOf = (site: Site): RecoveryStore => ({
	get: (key) => getLocalBackup<EntryForm>(key, site),
	put: (record) => saveLocalBackup(record, site),
	delete: (key) => deleteLocalBackup(key, site),
});

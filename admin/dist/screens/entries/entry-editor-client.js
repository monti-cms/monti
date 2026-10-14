import { deleteLocalBackup, getLocalBackup, saveLocalBackup } from "./local-backup.js";
/**
 * The browser's IndexedDB, in a database of the site's own (two sites on one origin keep their copies apart).
 *
 * @experimental
 */
export const localRecoveryStoreOf = (site) => ({
    get: (key) => getLocalBackup(key, site),
    put: (record) => saveLocalBackup(record, site),
    delete: (key) => deleteLocalBackup(key, site),
});

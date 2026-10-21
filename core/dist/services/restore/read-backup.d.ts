import type { BackupRead } from "./types.js";
/**
 * Reads an uploaded zip as a full backup, by the layout the export of this version writes (`EXPORT_FORMAT_VERSION`): `manifest.json`, `entries/<collection>/<id>/…`,
 * `folders.json`, `addresses.json`, `templates.json`, `media.json` and `preferences.json`. Nothing is written. A file that is not a zip, or has no readable manifest, is
 * refused. An archive that is not a full backup (a public export, or a selection) is returned with `isBackup: false` and nothing read from it. A file of one entry that
 * cannot be read becomes a problem of that entry, and the entry is left out of the plan, so the restore is refused with everything listed.
 */
export declare function readBackupArchive(bytes: Uint8Array): BackupRead;

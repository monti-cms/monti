import type { RestoreResult } from "../../core/store/types.js";
import type { RestoreHost, RestorePreview } from "./types.js";
/**
 * Reads an uploaded backup and says what restoring it would do, and whether it can. Nothing is written. The site must be empty (no entries, folders or media
 * records; the seeded templates may be there) and the archive a full backup; every body is checked against the current schema. The store checks the emptiness
 * again inside the transaction of the run.
 */
export declare function planRestore(host: RestoreHost, bytes: Uint8Array): Promise<RestorePreview>;
/** Restores a previewed backup in one transaction. The caller has checked that it is `ready`; the store checks the site is still empty. */
export declare const runRestore: (host: RestoreHost, preview: RestorePreview) => Promise<RestoreResult>;

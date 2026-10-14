import type { MigrationUp } from "./types.js";
/**
 * The whole schema of a new store. Pre-release databases that were built from the earlier numbered steps are not upgraded (see `database_outdated`):
 * from here on, a change to the schema is a new file with the next number.
 */
export declare const up: MigrationUp;

import type { PoolClient } from "pg";
import type { LegacyBodies } from "../../../format/types.js";
import type { Site } from "../../../site/index.js";
export interface SoftBreakMigrationOptions {
    /** The site the store is migrated for (its blocks decide the search text of a body). */
    readonly site: Site;
    /** Reads and writes the MDX text of these bodies (supplied by the `mdx` format). */
    readonly bodies: LegacyBodies;
    readonly batchSize?: number;
    /** Called for each body that is left as it is (it does not parse, or the edit could not be made safely). Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
/**
 * Makes the soft line endings of stored bodies explicit (`<br />`), because the public page no longer turns a single newline into a line break
 * (see `insertSoftBreaks`). Covers the working and published bodies, the source a translation was last confirmed against (`translation.baseSource`,
 * which the translation screen compares with the source, so it must read the same way), and the body templates.
 *
 * The same pass recomputes `content_hash` and `search_text` of every body. `version`, `updated_at` and the entry itself are not touched, and a body
 * that does not parse is left as it is (and logged). Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function migrateSoftBreaks(client: PoolClient, qSchema: string, options: SoftBreakMigrationOptions): Promise<void>;

import type { PoolClient } from "pg";
import type { LegacyBodies } from "../../../format/types.js";
import type { Site } from "../../../site/index.js";
export interface StoredDocumentMigrationOptions {
    /** The site the store is migrated for (its blocks decide the search text of a body). */
    readonly site: Site;
    /** Reads and writes the MDX text of these bodies (supplied by the `mdx` format). */
    readonly bodies: LegacyBodies;
    readonly batchSize?: number;
    /** Called for each body that gets no document and is left as it is. Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
/**
 * Gives every stored body its document (`doc`) and writes its MDX from it with the site's syntax (see `bodyFromMdx`). Covers the working and published
 * bodies, the source a translation was last confirmed against (`translation.baseSource`, which the translation screen compares with the source,
 * so it must be written the same way), and the body templates.
 *
 * The same pass recomputes `content_hash` and `search_text` of every body, because the MDX may have been rewritten. `version`, `updated_at` and the
 * entry itself are not touched. A body that gets no document (it does not parse, has front matter, or would not read back the same) is left as it is
 * and logged. Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function migrateStoredDocuments(client: PoolClient, qSchema: string, options: StoredDocumentMigrationOptions): Promise<void>;

import type { PoolClient } from "pg";
import type { LegacyBodies } from "../../../format/types.js";
import type { Site } from "../../../site/index.js";
export interface CodeAnnotationMigrationOptions {
    /** The site the store is migrated for (its blocks decide the search text of a body). */
    readonly site: Site;
    /** Reads and writes the MDX text of these bodies (supplied by the `mdx` format). */
    readonly bodies: LegacyBodies;
    readonly batchSize?: number;
    /** Called for each body that is left as it is (its document cannot be read or would not read back the same). Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
/**
 * Moves the stored documents to the form of a code block that holds its code and its annotations as data (document version 2), and writes the MDX from
 * them, so the annotation comments of a code fence are written the way Monti writes them (`// @line plus` is `// @line plus {0-0}`, rules that apply to the
 * whole code come first). Covers working and published bodies, the stored document of the source a translation was last confirmed against
 * (`translation.baseDoc`, with `translation.baseSource` written from it, so the translation screen still compares like with like) and body templates.
 *
 * `content_hash` and `search_text` of every body are recomputed, because the hash covers the stored form and the search text no longer holds annotation
 * comments. Block ids are kept; `version`, `updated_at` and the entry itself are not touched. A body whose document cannot be read is left as it is and logged.
 * Running it again changes nothing, and rows that would not change are not written.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function migrateCodeAnnotations(client: PoolClient, qSchema: string, options: CodeAnnotationMigrationOptions): Promise<void>;

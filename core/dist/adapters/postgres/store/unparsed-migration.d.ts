import type { PoolClient } from "pg";
export interface UnparsedMigrationOptions {
    readonly batchSize?: number;
    /** Called once per kind of finding with the ids involved. Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
/**
 * Every stored body is a document now. A body that had none (its MDX did not parse, had front matter, or would not read back the same)
 * becomes the document of one `unparsed` node that holds its MDX as it was: it shows as it is in the editor and `unparsed_body` blocks publishing it.
 * Covers the working and published bodies and the templates. `mdx` and `search_text` are kept; `content_hash` is recomputed (a document is hashed
 * as a document, and the text of an unparsed one under its own tag); `version` and `updated_at` are not touched.
 *
 * A published body or template that gets no document is a page that now reads as unparsed; none of them stops the migration (the owner's
 * data must always migrate), but they are logged by id so they can be fixed. Also lifts the translation state of every translation to version 4
 * (the document of the source it was confirmed against, no MDX text). Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function migrateUnparsedBodies(client: PoolClient, qSchema: string, options?: UnparsedMigrationOptions): Promise<{
    readonly drafts: number;
    readonly published: readonly string[];
    readonly templates: readonly string[];
}>;

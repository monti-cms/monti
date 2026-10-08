import type { PoolClient } from "pg";
export interface TemplatesDocumentsOptions {
    readonly batchSize?: number;
    /** Called with the ids of the templates that had no document. Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
/**
 * A body template is a document, like an entry body: `doc` is its only source and `mdx` is no longer written. A template that has no readable document
 * (its MDX did not parse, so migration 0017 or an earlier write left none, or the column holds something that is not a stored document) becomes the
 * document of one `unparsed` node that holds its MDX as it was, so the template shows as it is in the editor. `mdx` stays in the column for the
 * rows that have it (nothing reads it any more) and the column stops being required, so new templates are written without it.
 * Nothing here fails because of a template: the data of an existing store always migrates. Running it again changes nothing.
 * Rows are read in key order, `batchSize` at a time. Runs inside the caller's transaction.
 */
export declare function migrateTemplatesToDocuments(client: PoolClient, qSchema: string, options?: TemplatesDocumentsOptions): Promise<{
    readonly unparsed: readonly string[];
}>;

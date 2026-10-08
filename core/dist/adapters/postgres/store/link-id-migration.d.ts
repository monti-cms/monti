import type { PoolClient } from "pg";
import type { Site } from "../../../site/index.js";
export interface LinkEntryIdMigrationOptions {
    readonly batchSize?: number;
    /** Called once per body that holds an internal-looking link nothing resolves, and once at the end with the totals. Default: `console.warn`. */
    readonly log?: (message: string) => void;
}
export interface LinkEntryIdMigrationReport {
    /** Links turned into links by entry id. */
    readonly converted: number;
    /** Internal-looking links no address resolves; they stay as they are. */
    readonly unresolved: number;
}
/**
 * Moves the links of every stored document from the address they were written with (`href`) to the id of the entry they point to (`entryId`, the
 * translation group id; document version 3). Covers the working and published bodies, the document a translation was last confirmed against
 * (`translation.baseDoc`) and the body templates. An address is looked up in `content_addresses` (default language; current, former and reserved addresses
 * all name an entry), so a link written before a rename still finds its entry. A link that looks internal but resolves to nothing stays as it is and is
 * logged (publishing reports it as `unresolved_internal_link`); nothing here fails because of such a link, so the data of an existing store always migrates.
 *
 * `content_hash` of every body is recomputed (the document, with its version, is what is hashed), working and
 * published bodies together so "unpublished changes" keeps meaning what it meant. `version`, `updated_at` and block ids are not touched. Also rebuilds the
 * body references: every link by id is a reference to its entry (`kind: 'entry'`, occurrence `{type:"body", blockId}`), replacing the body occurrences
 * a reference had (those of relation fields stay). Running it again changes nothing; rows that would not change are not written.
 * Rows are read in key order, `batchSize` at a time, so memory stays flat on a large store. Runs inside the caller's transaction.
 */
export declare function migrateLinkEntryIds(site: Site, client: PoolClient, qSchema: string, options?: LinkEntryIdMigrationOptions): Promise<LinkEntryIdMigrationReport>;

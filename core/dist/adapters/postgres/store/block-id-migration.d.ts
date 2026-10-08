import type { PoolClient } from "pg";
export interface BlockIdMigrationOptions {
    readonly batchSize?: number;
}
/**
 * Gives every block of every stored document an id (see `block-ids.ts`): working and published bodies and body templates. Only `doc` changes; `mdx`,
 * `content_hash`, `search_text`, `version` and `updated_at` are not touched, because ids are not part of what a body says. A block keeps the id it has;
 * a block of a published body that pairs with a block of the entry's working body takes that block's id, so the two share ids the way a publish makes them.
 * Running it again changes nothing, and rows that would not change are not written.
 * Entries are read in key order, `batchSize` at a time, both bodies of an entry in the same batch. Runs inside the caller's transaction.
 */
export declare function migrateBlockIds(client: PoolClient, qSchema: string, options?: BlockIdMigrationOptions): Promise<void>;

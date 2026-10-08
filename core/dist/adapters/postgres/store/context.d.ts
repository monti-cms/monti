import type { Pool, PoolClient } from "pg";
import type { Entry } from "../../../core/store/types.js";
import type { Site } from "../../../site/index.js";
import { type Db } from "../db/kysely.js";
export type ContentStoreHooks = {
    beforePublishCommit?: (entry: Entry, txClient: PoolClient) => Promise<void>;
};
/** Connection and schema shared by the store modules. SQL schema names use only validated identifiers. */
export interface StoreContext {
    readonly pool: Pool;
    /** The site the store works for: its collections, locales, blocks and links. */
    readonly site: Site;
    readonly qSchema: string;
    /**
     * Kysely on this store's schema. Without `tx` its queries borrow a connection from the pool; given the `PoolClient` of a `withTransaction` it runs on that
     * client, so Kysely and `client.query` share the connection and the transaction (see `db/kysely.ts`).
     */
    readonly db: (tx?: PoolClient) => Db;
    readonly hooks: ContentStoreHooks;
}
export declare function validateSchemaName(schema?: string): string;
/**
 * Opens a transaction. On failure it rolls back and rethrows the error mapped to a stable one by `mapError`.
 * A ROLLBACK error on an already finished transaction is ignored so it does not hide the original error.
 */
export declare function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>, options?: {
    begin?: string;
    mapError?: (err: unknown) => unknown;
}): Promise<T>;
/**
 * `withTransaction` for code that uses Kysely: `fn` gets `trx`, a `Db` on the transaction's own client, and the `client` itself for the code that still writes
 * plain SQL, so both can be used in one transaction and roll back together.
 */
export declare function withTrx<T>(ctx: Pick<StoreContext, "pool" | "qSchema">, fn: (trx: Db, client: PoolClient) => Promise<T>, options?: {
    begin?: string;
    mapError?: (err: unknown) => unknown;
}): Promise<T>;

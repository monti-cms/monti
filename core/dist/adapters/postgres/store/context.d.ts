import type { Pool, PoolClient } from "pg";
import type { Entry } from "./types.js";
export type ContentStoreHooks = {
    beforePublishCommit?: (entry: Entry, txClient: PoolClient) => Promise<void>;
};
/** Connection and schema shared by the store modules. SQL schema names use only validated identifiers. */
export interface StoreContext {
    readonly pool: Pool;
    readonly qSchema: string;
    readonly hooks: ContentStoreHooks;
}
export type Queryable = Pool | PoolClient;
export declare function validateSchemaName(schema?: string): string;
/**
 * Opens a transaction. On failure it rolls back and rethrows the error mapped to a stable one by `mapError`.
 * A ROLLBACK error on an already finished transaction is ignored so it does not hide the original error.
 */
export declare function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>, options?: {
    begin?: string;
    mapError?: (err: unknown) => unknown;
}): Promise<T>;

import type { Pool, PoolClient } from "pg";
/** List of step names (for tests and docs). */
export declare const CONTENT_STORE_MIGRATIONS: readonly string[];
/**
 * Creates the schema or brings it up to date. Creates the schema if missing (the `schema` option), then runs only the steps that have not run yet, in numbered order.
 * It is one transaction, so a mid-way failure changes nothing, and concurrent runs on the same schema go one at a time.
 */
export declare function migrateContentStore(pool: Pool, options?: {
    schema?: string;
}): Promise<void>;
/**
 * Run-once job (for example, a plugin moving legacy data). Calls `run` and records the name only when the name is not in `cms_migrations`.
 * It runs inside a transaction holding the same lock as the core migrations, so concurrent calls still run it once. A failure does not record the name.
 * Prefix the name with the plugin name so it never collides across the store (for example `ai:move-old-settings`).
 * @returns whether it ran this time
 */
export declare function runOnce(pool: Pool, options: {
    schema?: string;
}, name: string, run: (client: PoolClient) => Promise<void>): Promise<boolean>;

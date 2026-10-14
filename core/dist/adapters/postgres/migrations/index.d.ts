import type { Pool, PoolClient } from "pg";
import type { Site } from "../../../site/index.js";
import type { MigrationContext } from "./types.js";
/** List of step names (for tests and docs). */
export declare const CONTENT_STORE_MIGRATIONS: readonly string[];
/** Creates the schema and the step record table (after taking the lock). */
export declare function prepare(client: PoolClient, qSchema: string): Promise<void>;
/** The error for a database built by an earlier pre-release of Monti, whose steps this version no longer has. */
export declare const databaseOutdatedError: () => import("../../../index.js").SetupError;
/**
 * Whether a record of `cms_migrations` is one this version knows: a core step, the seed job, or the record of a plugin's run-once job or a schema
 * transform (`plugin:...`, `schema:...`). Anything else with a number in front is a step of an earlier pre-release.
 */
export declare const isOutdatedMigrationName: (name: string) => boolean;
/**
 * Creates the schema or brings it up to date. Creates the schema if missing (the `schema` option), runs only the steps that have not run yet, in order, and then
 * the seed of the initial body templates if it has not run. It is one transaction, so a mid-way failure changes nothing, and concurrent runs on the same schema go
 * one at a time. A database whose record holds steps this version does not have (built by an older pre-release) is refused.
 */
export declare function migrateContentStore(pool: Pool, options: {
    site: Site;
    schema?: string;
    formats?: MigrationContext["formats"];
}): Promise<{
    applied: number;
    upToDate: number;
}>;
/**
 * Run-once job (for example, a plugin moving data). Calls `run` and records the name only when the name is not in `cms_migrations`.
 * It runs inside a transaction holding the same lock as the core migrations, so concurrent calls still run it once. A failure does not record the name.
 * Prefix the name with the plugin name so it never collides across the store (for example `ai:move-old-settings`).
 * @returns whether it ran this time
 */
export declare function runOnce(pool: Pool, options: {
    schema?: string;
}, name: string, run: (client: PoolClient) => Promise<void>): Promise<boolean>;

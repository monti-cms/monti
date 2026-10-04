import { Pool } from "pg";
import type { PluginDatabase } from "../../plugin/define.js";
import type { DatabaseAdapter } from "../../server/define.js";
export interface PostgresOptions {
    /** Connection string. Throws on first use if missing (it may be empty during builds). */
    readonly connectionString: string | undefined;
    /** Schema that holds the tables. Change it when the same DB is shared with previews or staging. Defaults to `public`. */
    readonly schema?: string;
}
/** Postgres content store. */
export declare function postgres(options: PostgresOptions): DatabaseAdapter;
/** DB used by plugins (connection, schema, run-once jobs). Tests build the same shape. */
export declare function pluginDatabaseFor(pool: Pool, schema?: string): PluginDatabase;

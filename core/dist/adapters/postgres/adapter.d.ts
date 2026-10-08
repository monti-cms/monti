import type { DatabaseAdapter } from "../../server/define.js";
/** The environment variable `postgres()` reads the connection string from when `connectionString` is not given. */
export declare const DATABASE_URL_ENV = "DATABASE_URL";
/** The environment variable `postgres()` reads the schema name from when `schema` is not given. */
export declare const DATABASE_SCHEMA_ENV = "DATABASE_SCHEMA";
export interface PostgresOptions {
    /** Connection string. If unset, the `DATABASE_URL` environment variable. Throws on first use if both are missing (they may be absent during builds). */
    readonly connectionString?: string | undefined;
    /** Schema that holds the tables. Change it when the same DB is shared with previews or staging. If unset, the `DATABASE_SCHEMA` environment variable, else `public`. */
    readonly schema?: string | undefined;
}
/**
 * Postgres content store. It works with no arguments: the connection string is read from `DATABASE_URL` and the schema name from `DATABASE_SCHEMA`
 * (no other variable is looked at), and a value passed here wins. The environment is read when the connection is first used, so building the app
 * without it does not fail; a missing connection string is an error that names the variable.
 */
export declare function postgres(options?: PostgresOptions): DatabaseAdapter;

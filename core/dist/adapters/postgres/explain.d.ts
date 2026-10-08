import { SetupError } from "../../core/problem.js";
/** Where the database settings live, for the `where` of a message. */
export declare const DATABASE_URL_WHERE = "DATABASE_URL in .env.local (or in the environment of the host), or `postgres({ connectionString })` in monti.config.ts";
/** `host:port/database` of a connection string, with no user or password. `undefined` when it cannot be read. */
export declare function describeConnection(connectionString: string | undefined): string | undefined;
/**
 * What a Postgres driver error means for someone setting the site up, or `undefined` when it is not a setup problem (a constraint violation, a bug). It covers
 * the first errors a newcomer meets: no database listening, a wrong address, password or database name, a database that is not migrated, an SSL mismatch.
 * `connectionString` and `schema` are the ones in use, to name them in the message (the password is never printed).
 */
export declare function explainDatabaseError(error: unknown, context?: {
    readonly connectionString?: string | undefined;
    readonly schema?: string | undefined;
}): SetupError | undefined;

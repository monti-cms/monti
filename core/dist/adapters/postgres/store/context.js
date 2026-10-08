import { problemError } from "../../../core/problem.js";
import { dbOn } from "../db/kysely.js";
export function validateSchemaName(schema) {
    const s = schema ?? "public";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
        throw problemError({
            what: `The database schema name "${s}" is not valid`,
            where: "DATABASE_SCHEMA in .env.local, or `postgres({ schema })` in monti.config.ts",
            fix: "use letters, digits and underscores only, starting with a letter or underscore (for example monti_preview)",
        });
    }
    return s;
}
/**
 * Opens a transaction. On failure it rolls back and rethrows the error mapped to a stable one by `mapError`.
 * A ROLLBACK error on an already finished transaction is ignored so it does not hide the original error.
 */
export async function withTransaction(pool, fn, options) {
    const client = await pool.connect();
    try {
        await client.query(options?.begin ?? "BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        try {
            await client.query("ROLLBACK");
        }
        catch {
            // Ignore transactions that already ended.
        }
        throw options?.mapError ? options.mapError(err) : err;
    }
    finally {
        client.release();
    }
}
/**
 * `withTransaction` for code that uses Kysely: `fn` gets `trx`, a `Db` on the transaction's own client, and the `client` itself for the code that still writes
 * plain SQL, so both can be used in one transaction and roll back together.
 */
export function withTrx(ctx, fn, options) {
    return withTransaction(ctx.pool, (client) => fn(dbOn(client, ctx.qSchema), client), options);
}

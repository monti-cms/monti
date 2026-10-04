export function validateSchemaName(schema) {
    const s = schema ?? "public";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
        throw new Error("Invalid schema name");
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

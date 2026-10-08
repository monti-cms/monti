import { Kysely, PostgresDialect, PostgresDriver, } from "kysely";
/** What the pool-bound `Db` sees of the pool: it can lend a connection, and cannot end the pool (`Db.destroy()` would otherwise close the adapter's pool). */
const lendOnly = (pool) => ({
    connect: () => pool.connect(),
    end: async () => { },
    options: pool.options,
});
/** One `Db` for a store: its queries run on connections borrowed from `pool`, in the schema `qSchema` (an already validated identifier). */
export function createDb(pool, qSchema) {
    return new Kysely({ dialect: new PostgresDialect({ pool: lendOnly(pool) }) }).withSchema(qSchema);
}
/** Thrown by a client-bound `Db` that is asked to open or end a transaction: the transaction belongs to whoever owns the client. */
const transactionOwnedElsewhere = () => new Error("cms: this Kysely instance runs inside a transaction that withTransaction owns. Do not open or end a transaction on it (.transaction(), .startTransaction()); use the surrounding withTransaction.");
class ClientDriver extends PostgresDriver {
    async beginTransaction(_connection) {
        throw transactionOwnedElsewhere();
    }
    async commitTransaction(_connection) {
        throw transactionOwnedElsewhere();
    }
    async rollbackTransaction(_connection) {
        throw transactionOwnedElsewhere();
    }
}
class ClientDialect extends PostgresDialect {
    #client;
    constructor(client) {
        super({ pool: client });
        this.#client = client;
    }
    createDriver() {
        return new ClientDriver({ pool: this.#client });
    }
}
/** A pool of one: it hands out the same client every time and its `release` does nothing, so the client goes back to the real pool only when its owner releases it. */
const poolOf = (client) => {
    const shared = {
        query: client.query.bind(client),
        release: () => { },
        get processID() {
            return client.processID;
        },
    };
    return { connect: async () => shared, end: async () => { }, options: {} };
};
const onClients = new WeakMap();
/**
 * The `Db` that runs on `client` (the connection `withTransaction` handed out). Its queries see what the same client wrote through `client.query`,
 * and they commit or roll back with it. It cannot open its own transaction.
 */
export function dbOn(client, qSchema) {
    let bySchema = onClients.get(client);
    if (!bySchema) {
        bySchema = new Map();
        onClients.set(client, bySchema);
    }
    let db = bySchema.get(qSchema);
    if (!db) {
        db = new Kysely({ dialect: new ClientDialect(poolOf(client)) }).withSchema(qSchema);
        bySchema.set(qSchema, db);
    }
    return db;
}

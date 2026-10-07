import {
	type DatabaseConnection,
	Kysely,
	PostgresDialect,
	PostgresDriver,
	type PostgresPool,
	type PostgresPoolClient,
} from "kysely";
import type { Pool, PoolClient } from "pg";
import type { Database } from "./database";

/**
 * Kysely on the connections the adapter already owns. Kysely never opens a connection of its own and never closes one: the `pg.Pool` is created, shared and
 * ended by `postgres()` (`adapter.ts`), and a transaction is opened by `withTransaction` (`store/context.ts`). So there are exactly two ways to get a `Db`:
 *
 * - `createDb(pool, qSchema)`: every query takes a connection from the pool, like `pool.query` does. One per store.
 * - `dbOn(client, qSchema)`: every query runs on that one `PoolClient`, which is how code inside `withTransaction` mixes Kysely with plain SQL (`client.query`)
 *   on the same connection, the same transaction and the same rollback. It is cached per client, so asking for it again is free.
 *
 * Both qualify every table with the runtime schema (`withSchema`), so a query names `entries`, never `"my_schema".entries`. A `sql` fragment is not
 * rewritten, though: inside one, name a table with `sql.id(qSchema, "entries")` (`ctx.qSchema` is the validated schema name), never as a bare word.
 */
export type Db = Kysely<Database>;

/** What the pool-bound `Db` sees of the pool: it can lend a connection, and cannot end the pool (`Db.destroy()` would otherwise close the adapter's pool). */
const lendOnly = (pool: Pool): PostgresPool => ({
	connect: () => pool.connect() as unknown as Promise<PostgresPoolClient>,
	end: async () => {},
	options: pool.options,
});

/** One `Db` for a store: its queries run on connections borrowed from `pool`, in the schema `qSchema` (an already validated identifier). */
export function createDb(pool: Pool, qSchema: string): Db {
	return new Kysely<Database>({ dialect: new PostgresDialect({ pool: lendOnly(pool) }) }).withSchema(qSchema);
}

/** Thrown by a client-bound `Db` that is asked to open or end a transaction: the transaction belongs to whoever owns the client. */
const transactionOwnedElsewhere = () =>
	new Error(
		"cms: this Kysely instance runs inside a transaction that withTransaction owns. Do not open or end a transaction on it (.transaction(), .startTransaction()); use the surrounding withTransaction.",
	);

class ClientDriver extends PostgresDriver {
	override async beginTransaction(_connection: DatabaseConnection): Promise<void> {
		throw transactionOwnedElsewhere();
	}
	override async commitTransaction(_connection: DatabaseConnection): Promise<void> {
		throw transactionOwnedElsewhere();
	}
	override async rollbackTransaction(_connection: DatabaseConnection): Promise<void> {
		throw transactionOwnedElsewhere();
	}
}

class ClientDialect extends PostgresDialect {
	readonly #client: PostgresPool;
	constructor(client: PostgresPool) {
		super({ pool: client });
		this.#client = client;
	}
	override createDriver() {
		return new ClientDriver({ pool: this.#client });
	}
}

/** A pool of one: it hands out the same client every time and its `release` does nothing, so the client goes back to the real pool only when its owner releases it. */
const poolOf = (client: PoolClient): PostgresPool => {
	const shared = {
		query: client.query.bind(client),
		release: () => {},
		get processID() {
			return (client as unknown as { processID?: number }).processID;
		},
	} as unknown as PostgresPoolClient;
	return { connect: async () => shared, end: async () => {}, options: {} };
};

const onClients = new WeakMap<PoolClient, Map<string, Db>>();

/**
 * The `Db` that runs on `client` (the connection `withTransaction` handed out). Its queries see what the same client wrote through `client.query`,
 * and they commit or roll back with it. It cannot open its own transaction.
 */
export function dbOn(client: PoolClient, qSchema: string): Db {
	let bySchema = onClients.get(client);
	if (!bySchema) {
		bySchema = new Map();
		onClients.set(client, bySchema);
	}
	let db = bySchema.get(qSchema);
	if (!db) {
		db = new Kysely<Database>({ dialect: new ClientDialect(poolOf(client)) }).withSchema(qSchema);
		bySchema.set(qSchema, db);
	}
	return db;
}

import { Kysely } from "kysely";
import type { Pool, PoolClient } from "pg";
import type { Database } from "./database.js";
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
/** One `Db` for a store: its queries run on connections borrowed from `pool`, in the schema `qSchema` (an already validated identifier). */
export declare function createDb(pool: Pool, qSchema: string): Db;
/**
 * The `Db` that runs on `client` (the connection `withTransaction` handed out). Its queries see what the same client wrote through `client.query`,
 * and they commit or roll back with it. It cannot open its own transaction.
 */
export declare function dbOn(client: PoolClient, qSchema: string): Db;

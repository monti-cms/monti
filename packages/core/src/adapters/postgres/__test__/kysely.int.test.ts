import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { migrateContentStore } from "../content-store";
import { type createDb, dbOn } from "../db/kysely";
import { type StoreContext, withTransaction, withTrx } from "../store/context";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Kysely on the adapter's pool and on a transaction's client: the schema, the shared connection and the rollback. */
describe("kysely", () => {
	let pool: Pool;
	let schema: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schema = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema });
	});

	afterAll(async () => {
		if (pool && schema) await dropIsolatedTestPool(pool, schema);
		await closeGlobalPool();
	});

	const ctxOf = (): Pick<StoreContext, "pool" | "qSchema"> => ({ pool, qSchema: schema });
	const documents = async (plugin: string) =>
		(
			await pool.query<{ key: string }>(`SELECT key FROM "${schema}".plugin_documents WHERE plugin = $1 ORDER BY key`, [
				plugin,
			])
		).rows.map((row) => row.key);
	const insertRaw = (client: Pick<Pool, "query">, plugin: string, key: string) =>
		client.query(
			`INSERT INTO "${schema}".plugin_documents (plugin, collection, key, value) VALUES ($1, 'c', $2, '{}')`,
			[plugin, key],
		);
	const insertKysely = (db: ReturnType<typeof createDb>, plugin: string, key: string) =>
		db.insertInto("plugin_documents").values({ plugin, collection: "c", key, value: "{}" }).execute();
	/** How many connections wait for a lock in a query on this schema. */
	const _lockWaiters = async () =>
		(
			await pool.query<{ count: number }>(
				"SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1",
				[`%"${schema}"%`],
			)
		).rows[0]?.count ?? 0;

	describe("the instance of a store", () => {
		it("is made once per client and schema for a transaction, so asking for it again costs nothing", async () => {
			const client = await pool.connect();
			try {
				expect(dbOn(client, schema)).toBe(dbOn(client, schema));
				expect(dbOn(client, schema)).not.toBe(dbOn(client, "other"));
			} finally {
				client.release();
			}
		});
	});

	describe("inside a transaction", () => {
		it("`withTrx` hands out the Kysely handle and the client of one transaction, and commits both writes", async () => {
			await withTrx(ctxOf(), async (trx, client) => {
				await insertKysely(trx, "trx", "kysely");
				await insertRaw(client, "trx", "raw");
			});
			expect(await documents("trx")).toEqual(["kysely", "raw"]);
		});

		it("`withTrx` rolls back both and maps the error like `withTransaction` does", async () => {
			await expect(
				withTrx(
					ctxOf(),
					async (trx, client) => {
						await insertKysely(trx, "trx-fail", "kysely");
						await insertRaw(client, "trx-fail", "raw");
						throw new Error("inner");
					},
					{ mapError: (err) => new Error(`mapped: ${(err as Error).message}`) },
				),
			).rejects.toThrow("mapped: inner");
			expect(await documents("trx-fail")).toEqual([]);
		});

		it("refuses to open a transaction of its own: that would end the owner's early", async () => {
			await expect(
				withTransaction(pool, async (client) => {
					await insertKysely(dbOn(client, schema), "nested", "a");
					await dbOn(client, schema)
						.transaction()
						.execute(async () => {});
				}),
			).rejects.toThrow("withTransaction owns");
			// The owner's transaction was not committed by the attempt: it rolled back as a whole.
			expect(await documents("nested")).toEqual([]);
		});
	});
});

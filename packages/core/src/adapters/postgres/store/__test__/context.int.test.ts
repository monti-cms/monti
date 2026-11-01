import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../../test/site";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { migrateContentStore } from "../../content-store";
import type { createDb } from "../../db/kysely";
import { type StoreContext, withTrx } from "../context";

/** `withTrx`: Kysely and the raw client of one transaction, committed and rolled back together. */
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
	});
});

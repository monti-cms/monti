import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { defineCollection, defineConfig, fields } from "../../../index";
import { createSite } from "../../../site";
import { migrateContentStore } from "../content-store";
import { createDb, dbOn } from "../db/kysely";
import { type StoreContext, withTransaction, withTrx } from "../store/context";
import { ROW_COLLECTION, titleExpr, translatedTitleExpr } from "../store/title-sql";
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

	describe("the instance of a store", () => {
		it("puts the runtime schema on every table, so a query names only the table", () => {
			const db = createDb(pool, schema);
			expect(
				db.selectFrom("entries as e").innerJoin("entry_bodies as b", "b.entry_id", "e.id").select("e.id").compile().sql,
			).toBe(
				`select "e"."id" from "${schema}"."entries" as "e" inner join "${schema}"."entry_bodies" as "b" on "b"."entry_id" = "e"."id"`,
			);
		});

		it("reads and writes the store's own schema through the pool", async () => {
			const db = createDb(pool, schema);
			await insertKysely(db, "pool", "k1");
			expect(await documents("pool")).toEqual(["k1"]);
			expect(await db.selectFrom("plugin_documents").select("key").where("plugin", "=", "pool").execute()).toEqual([
				{ key: "k1" },
			]);
		});

		it("lends connections and gives them back: many more queries than connections still finish", async () => {
			const db = createDb(pool, schema);
			const results = await Promise.all(
				Array.from({ length: 40 }, () => sql<{ one: number }>`select 1 as one`.execute(db)),
			);
			expect(results).toHaveLength(40);
		});

		it("does not own the pool: destroying the instance leaves the pool usable", async () => {
			await createDb(pool, schema).destroy();
			expect((await pool.query("SELECT 1 AS one")).rows).toEqual([{ one: 1 }]);
		});

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
		it("runs on the very connection of the transaction", async () => {
			await withTransaction(pool, async (client) => {
				const raw = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]?.pid;
				const viaKysely = (await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(dbOn(client, schema)))
					.rows[0]?.pid;
				expect(viaKysely).toBe(raw);
			});
		});

		it("sees what plain SQL wrote in the same transaction, and the other way around, before any commit", async () => {
			await withTransaction(pool, async (client) => {
				const db = dbOn(client, schema);
				await insertRaw(client, "mixed", "raw-first");
				await insertKysely(db, "mixed", "kysely-first");
				const viaKysely = await db
					.selectFrom("plugin_documents")
					.select("key")
					.where("plugin", "=", "mixed")
					.orderBy("key")
					.execute();
				expect(viaKysely.map((row) => row.key)).toEqual(["kysely-first", "raw-first"]);
				const viaRaw = await client.query(`SELECT key FROM "${schema}".plugin_documents WHERE plugin = 'mixed'`);
				expect(viaRaw.rowCount).toBe(2);
				// Another connection sees nothing yet: it is one open transaction.
				expect(await documents("mixed")).toEqual([]);
			});
			expect(await documents("mixed")).toEqual(["kysely-first", "raw-first"]);
		});

		it("rolls back what Kysely and plain SQL wrote together when the transaction fails", async () => {
			await expect(
				withTransaction(pool, async (client) => {
					await insertRaw(client, "rollback", "raw");
					await insertKysely(dbOn(client, schema), "rollback", "kysely");
					throw new Error("boom");
				}),
			).rejects.toThrow("boom");
			expect(await documents("rollback")).toEqual([]);
		});

		it("rolls back when it is a Kysely statement that fails (a duplicate key), including what plain SQL wrote before it", async () => {
			await expect(
				withTransaction(pool, async (client) => {
					await insertRaw(client, "dup", "a");
					await insertKysely(dbOn(client, schema), "dup", "b");
					await insertKysely(dbOn(client, schema), "dup", "b");
				}),
			).rejects.toMatchObject({ code: "23505" });
			expect(await documents("dup")).toEqual([]);
		});

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

		it("locks rows with FOR UPDATE through Kysely, so a second transaction waits for the first", async () => {
			await insertKysely(createDb(pool, schema), "lock", "row");
			const order: string[] = [];
			let release: () => void = () => {};
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			let locked: () => void = () => {};
			const isLocked = new Promise<void>((resolve) => {
				locked = resolve;
			});
			const first = withTrx(ctxOf(), async (trx) => {
				await trx.selectFrom("plugin_documents").select("key").where("plugin", "=", "lock").forUpdate().execute();
				locked();
				await held;
				order.push("first");
			});
			await isLocked;
			const second = withTrx(ctxOf(), async (trx) => {
				await trx.selectFrom("plugin_documents").select("key").where("plugin", "=", "lock").forUpdate().execute();
				order.push("second");
			});
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(order).toEqual([]);
			release();
			await Promise.all([first, second]);
			expect(order).toEqual(["first", "second"]);
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

		it("does not release the client: it is still the owner's after Kysely used it", async () => {
			const client = await pool.connect();
			try {
				await sql`select 1`.execute(dbOn(client, schema));
				await sql`select 2`.execute(dbOn(client, schema));
				expect((await client.query("SELECT 3 AS three")).rows).toEqual([{ three: 3 }]);
			} finally {
				client.release();
			}
		});
	});

	describe("the title expression", () => {
		const collection = (titleKey: string) =>
			defineCollection({
				label: "Collection",
				kind: "item",
				fields: { [titleKey]: fields.text({ label: "Title", role: "title" }) },
			});
		const site = createSite(
			defineConfig({
				collections: { a: collection("headline"), b: collection("name") },
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
			}),
		);

		it("reads the same titles as the SQL text, across collections and for one", async () => {
			const db = createDb(pool, schema);
			const now = new Date();
			const rows = [
				{ id: randomUUID(), collection: "a", metadata: { headline: "Head", name: "Not this" } },
				{ id: randomUUID(), collection: "b", metadata: { headline: "Not this", name: "Name" } },
				{ id: randomUUID(), collection: "a", metadata: { name: "no headline" } },
			];
			for (const row of rows) {
				await db
					.insertInto("entries")
					.values({ id: row.id, collection: row.collection, version: 1, created_at: now, updated_at: now })
					.execute();
				await db
					.insertInto("entry_bodies")
					.values({
						entry_id: row.id,
						state: "working",
						metadata: JSON.stringify(row.metadata),
						schema_version: 1,
						content_hash: "h",
						updated_at: now,
					})
					.execute();
			}
			const ids = rows.map((row) => row.id);

			const across = await db
				.selectFrom("entries as e")
				.innerJoin("entry_bodies as b", "b.entry_id", "e.id")
				.select(["e.id", titleExpr(site, "b.metadata", ROW_COLLECTION).as("title")])
				.where("e.id", "in", ids)
				.execute();
			const byId = (list: { id: string; title: string | null }[]) =>
				Object.fromEntries(list.map((row) => [row.id, row.title]));
			expect(byId(across)).toEqual({
				[ids[0] as string]: "Head",
				[ids[1] as string]: "Name",
				[ids[2] as string]: null,
			});

			const one = await db
				.selectFrom("entry_bodies as b")
				.select(titleExpr(site, "b.metadata", { collection: "b" }).as("title"))
				.where("b.entry_id", "=", ids[1] as string)
				.execute();
			expect(one).toEqual([{ title: "Name" }]);
		});

		it("reads the name in a display language, falling back to the title", async () => {
			const db = createDb(pool, schema);
			const id = randomUUID();
			const now = new Date();
			await db
				.insertInto("entries")
				.values({ id, collection: "b", version: 1, created_at: now, updated_at: now })
				.execute();
			await db
				.insertInto("entry_bodies")
				.values({
					entry_id: id,
					state: "working",
					metadata: JSON.stringify({ name: "Name", translations: { en: { name: "English" }, fr: { name: "  " } } }),
					schema_version: 1,
					content_hash: "h",
					updated_at: now,
				})
				.execute();
			for (const [locale, expected] of [
				["en", "English"],
				["fr", "Name"],
				["de", "Name"],
			] as const) {
				const viaKysely = await db
					.selectFrom("entry_bodies as b")
					.select(translatedTitleExpr(site, "b.metadata", "b", locale).as("title"))
					.where("b.entry_id", "=", id)
					.executeTakeFirstOrThrow();
				expect(viaKysely.title).toBe(expected);
			}
		});
	});
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { runPluginStorageContract } from "../../../plugin/__test__/storage-contract";
import { migrateContentStore } from "../content-store";
import { createPluginStorage, inPluginTransaction } from "../plugin-storage";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The Postgres plugin storage against the plugin storage contract: every session is a new schema, migrated like `monti db:migrate` does. */
runPluginStorageContract({
	name: "postgres",
	create: async () => {
		const { pool, schemaName } = await createIsolatedTestPool();
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		return {
			storage: (plugin) => createPluginStorage(pool, schemaName, plugin),
			seedLegacyTable: async (table, rows) => {
				await pool.query(
					`CREATE TABLE "${schemaName}"."${table}" (key TEXT PRIMARY KEY, value JSONB NOT NULL, version INTEGER NOT NULL)`,
				);
				for (const row of rows) {
					await pool.query(`INSERT INTO "${schemaName}"."${table}" (key, value, version) VALUES ($1, $2, $3)`, [
						row.key,
						JSON.stringify(row.value),
						row.version,
					]);
				}
			},
			recordMigration: async (name) => {
				await pool.query(`INSERT INTO "${schemaName}".cms_migrations (name) VALUES ($1)`, [name]);
			},
			close: () => dropIsolatedTestPool(pool, schemaName),
		};
	},
	dispose: closeGlobalPool,
});

describe("postgres plugin storage specifics", () => {
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
	});

	afterAll(async () => {
		await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("keeps documents in the core migration's table, one row per plugin, collection and key", async () => {
		const storage = createPluginStorage(pool, schemaName, "rows");
		await storage.collection("things").set("a", { n: 1 }, { expectedVersion: 0 });
		await createPluginStorage(pool, schemaName, "rows-two")
			.collection("things")
			.set("a", { n: 2 }, { expectedVersion: 0 });
		const rows = await pool.query<{ plugin: string; collection: string; key: string; value: unknown; version: number }>(
			`SELECT plugin, collection, key, value, version FROM "${schemaName}".plugin_documents ORDER BY plugin`,
		);
		expect(rows.rows).toEqual([
			{ plugin: "rows", collection: "things", key: "a", value: { n: 1 }, version: 1 },
			{ plugin: "rows-two", collection: "things", key: "a", value: { n: 2 }, version: 1 },
		]);
	});

	it("writes to several plugins' collections in one transaction: all kept, or none if the work throws", async () => {
		const failing = inPluginTransaction(pool, schemaName, async (tx) => {
			await tx.pluginStorage("tx-a").collection("things").set("a", { n: 1 }, { expectedVersion: 0 });
			await tx.pluginStorage("tx-b").collection("things").set("b", { n: 2 }, { expectedVersion: 0 });
			throw new Error("stop");
		});
		await expect(failing).rejects.toThrow("stop");
		expect(await createPluginStorage(pool, schemaName, "tx-a").collection("things").get("a")).toBeNull();
		expect(await createPluginStorage(pool, schemaName, "tx-b").collection("things").get("b")).toBeNull();

		await inPluginTransaction(pool, schemaName, async (tx) => {
			await tx.pluginStorage("tx-a").collection("things").set("a", { n: 1 }, { expectedVersion: 0 });
			await tx.pluginStorage("tx-b").collection("things").set("b", { n: 2 }, { expectedVersion: 0 });
		});
		expect((await createPluginStorage(pool, schemaName, "tx-a").collection("things").get("a"))?.value).toEqual({
			n: 1,
		});
		expect((await createPluginStorage(pool, schemaName, "tx-b").collection("things").get("b"))?.value).toEqual({
			n: 2,
		});
	});

	it("reads only tables of its own schema and refuses names that are not plain identifiers", async () => {
		await createPluginStorage(pool, schemaName, "reader").once("read-names", async (migration) => {
			expect(await migration.readLegacyTable("cms_migrations")).not.toBeNull();
			expect(await migration.readLegacyTable('x"; DROP TABLE y; --')).toBeNull();
			expect(await migration.readLegacyTable("pg_catalog.pg_class")).toBeNull();
		});
	});
});

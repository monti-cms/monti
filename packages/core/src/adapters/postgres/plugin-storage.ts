import { sql } from "kysely";
import type { Pool, PoolClient } from "pg";
import {
	assertExpectedVersionNumber,
	assertMigrationName,
	assertStorageKey,
	assertStorageName,
	assertStoredVersion,
	serializeStorageValue,
	storageConflict,
	storageNotFound,
} from "../../core/domain/plugin-storage";
import type {
	PluginCollection,
	PluginMigration,
	PluginStorage,
	StorageItem,
	StorageWriteOptions,
} from "../../plugin/storage";
import type { TransactionStorage } from "../../server/define";
import { createDb, type Db, dbOn } from "./db/kysely";
import { validateSchemaName, withTransaction } from "./store/context";

interface DocumentRow {
	key: string;
	value: unknown;
	version: number;
	created_at: Date;
	updated_at: Date;
}

/** The migration code is loaded when a step runs, not when the adapter is created. */
const loadSchemaModule = () => import("./store/schema");

const COLUMNS = ["key", "value", "version", "created_at", "updated_at"] as const;

const toItem = <T>(row: DocumentRow): StorageItem<T> => ({
	key: row.key,
	value: row.value as T,
	version: row.version,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

/** The value as a `jsonb` parameter: the JSON text, cast on the server like every write of this table always did. */
const jsonb = (json: string) => sql<string>`${json}::jsonb`;
const now = () => sql<Date>`now()`;

/** One collection of one plugin over a `Db` (on the pool, or on the client of a migration step's transaction). */
function collectionOf<T>(db: Db, plugin: string, name: string): PluginCollection<T> {
	assertStorageName("collection", name);
	const documents = () => db.selectFrom("plugin_documents").where("plugin", "=", plugin).where("collection", "=", name);
	const storedVersion = async (key: string): Promise<number> =>
		(await documents().select("version").where("key", "=", key).executeTakeFirst())?.version ?? 0;

	return {
		get: async (key) => {
			assertStorageKey(key);
			const row = await documents().select(COLUMNS).where("key", "=", key).executeTakeFirst();
			return row ? toItem<T>(row) : null;
		},

		list: async (options) => {
			let query = documents().select(COLUMNS);
			if (options?.prefix) query = query.where(sql<boolean>`starts_with(key, ${options.prefix})`);
			const rows = await query.orderBy(sql`key collate "C"`).execute();
			return rows.map((row) => toItem<T>(row));
		},

		// Each write is one statement, so two writers that expect the same version cannot both succeed.
		set: async (key, value, { expectedVersion }: StorageWriteOptions) => {
			assertStorageKey(key);
			assertExpectedVersionNumber(expectedVersion);
			const json = serializeStorageValue(value);
			const row =
				expectedVersion === 0
					? await db
							.insertInto("plugin_documents")
							.values({
								plugin,
								collection: name,
								key,
								value: jsonb(json),
								version: 1,
								created_at: now(),
								updated_at: now(),
							})
							.onConflict((conflict) => conflict.columns(["plugin", "collection", "key"]).doNothing())
							.returning(COLUMNS)
							.executeTakeFirst()
					: await db
							.updateTable("plugin_documents")
							.set({ value: jsonb(json), version: sql<number>`version + 1`, updated_at: now() })
							.where("plugin", "=", plugin)
							.where("collection", "=", name)
							.where("key", "=", key)
							.where("version", "=", expectedVersion)
							.returning(COLUMNS)
							.executeTakeFirst();
			if (!row) throw storageConflict(await storedVersion(key));
			return toItem<T>(row);
		},

		delete: async (key, { expectedVersion }: StorageWriteOptions) => {
			assertStorageKey(key);
			assertExpectedVersionNumber(expectedVersion);
			const res = await db
				.deleteFrom("plugin_documents")
				.where("plugin", "=", plugin)
				.where("collection", "=", name)
				.where("key", "=", key)
				.where("version", "=", expectedVersion)
				.executeTakeFirst();
			if (res.numDeletedRows === 1n) return;
			const stored = await storedVersion(key);
			throw stored === 0 ? storageNotFound() : storageConflict(stored);
		},
	};
}

/** What a migration step sees: the same collections, inside the step's transaction. */
function migrationOf(client: PoolClient, qSchema: string, plugin: string): PluginMigration {
	const db = dbOn(client, qSchema);
	return {
		collection: (name) => collectionOf(db, plugin, name),
	};
}

/** Records of one-time steps share the core migration log. A plugin's step is recorded as `plugin:<plugin>:<name>`. */
const stepRecord = (plugin: string, name: string) => `plugin:${plugin}:${name}`;

/** The storage of one plugin over a `Db`: the one factory behind both the pool's storage and a transaction's. */
function storageOn(db: Db, plugin: string, once: PluginStorage["once"]): PluginStorage {
	assertStorageName("plugin", plugin);
	return { plugin, collection: (name) => collectionOf(db, plugin, name), once };
}

/** The storage of one plugin in a Postgres schema. The `plugin_documents` table is created by the core migrations (`monti db:migrate`). */
export function createPluginStorage(pool: Pool, schema: string | undefined, plugin: string): PluginStorage {
	const qSchema = validateSchemaName(schema);
	return storageOn(createDb(pool, qSchema), plugin, async (name, step) => {
		assertMigrationName(name);
		let ran = false;
		await (await loadSchemaModule()).runOnce(pool, { schema: qSchema }, stepRecord(plugin, name), async (client) => {
			await step(migrationOf(client, qSchema, plugin));
			ran = true;
		});
		return ran;
	});
}

/**
 * Runs `work` in one transaction (`withTransaction`). The storage it hands out reads and writes through the transaction's client, for any plugin, so a write to
 * one plugin's collection and one to another's (the core key store and a plugin's settings) are kept or dropped together. `once` is not available inside it.
 */
export function inPluginTransaction<T>(
	pool: Pool,
	schema: string | undefined,
	work: (tx: TransactionStorage) => Promise<T>,
): Promise<T> {
	const qSchema = validateSchemaName(schema);
	return withTransaction(pool, (client) => {
		const db = dbOn(client, qSchema);
		return work({
			pluginStorage: (plugin) =>
				storageOn(db, plugin, async () => {
					throw new Error("plugin storage: `once` cannot run inside a transaction");
				}),
		});
	});
}

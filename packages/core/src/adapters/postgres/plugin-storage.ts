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
import { type Queryable, validateSchemaName } from "./store/context";

interface DocumentRow {
	key: string;
	value: unknown;
	version: number;
	created_at: Date;
	updated_at: Date;
}

/** The migration code is loaded when a step runs, not when the adapter is created. */
const loadSchemaModule = () => import("./store/schema");

const COLUMNS = "key, value, version, created_at, updated_at";

const toItem = <T>(row: DocumentRow): StorageItem<T> => ({
	key: row.key,
	value: row.value as T,
	version: row.version,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

/** One collection of one plugin over a connection (the pool, or the client of a migration step's transaction). */
function collectionOf<T>(db: Queryable, qSchema: string, plugin: string, name: string): PluginCollection<T> {
	assertStorageName("collection", name);
	const table = `"${qSchema}".plugin_documents`;
	const where = "plugin = $1 AND collection = $2 AND key = $3";
	const storedVersion = async (key: string): Promise<number> =>
		(await db.query<{ version: number }>(`SELECT version FROM ${table} WHERE ${where}`, [plugin, name, key])).rows[0]
			?.version ?? 0;

	return {
		get: async (key) => {
			assertStorageKey(key);
			const res = await db.query<DocumentRow>(`SELECT ${COLUMNS} FROM ${table} WHERE ${where}`, [plugin, name, key]);
			return res.rows[0] ? toItem<T>(res.rows[0]) : null;
		},

		list: async (options) => {
			const res = await db.query<DocumentRow>(
				`SELECT ${COLUMNS} FROM ${table}
				 WHERE plugin = $1 AND collection = $2 AND ($3::text IS NULL OR starts_with(key, $3))
				 ORDER BY key COLLATE "C"`,
				[plugin, name, options?.prefix || null],
			);
			return res.rows.map((row) => toItem<T>(row));
		},

		// Each write is one statement, so two writers that expect the same version cannot both succeed.
		set: async (key, value, { expectedVersion }: StorageWriteOptions) => {
			assertStorageKey(key);
			assertExpectedVersionNumber(expectedVersion);
			const json = serializeStorageValue(value);
			const res =
				expectedVersion === 0
					? await db.query<DocumentRow>(
							`INSERT INTO ${table} (plugin, collection, key, value, version, created_at, updated_at)
							 VALUES ($1, $2, $3, $4::jsonb, 1, NOW(), NOW())
							 ON CONFLICT (plugin, collection, key) DO NOTHING
							 RETURNING ${COLUMNS}`,
							[plugin, name, key, json],
						)
					: await db.query<DocumentRow>(
							`UPDATE ${table} SET value = $4::jsonb, version = version + 1, updated_at = NOW()
							 WHERE ${where} AND version = $5
							 RETURNING ${COLUMNS}`,
							[plugin, name, key, json, expectedVersion],
						);
			if (!res.rows[0]) throw storageConflict(await storedVersion(key));
			return toItem<T>(res.rows[0]);
		},

		delete: async (key, { expectedVersion }: StorageWriteOptions) => {
			assertStorageKey(key);
			assertExpectedVersionNumber(expectedVersion);
			const res = await db.query(`DELETE FROM ${table} WHERE ${where} AND version = $4`, [
				plugin,
				name,
				key,
				expectedVersion,
			]);
			if (res.rowCount === 1) return;
			const stored = await storedVersion(key);
			throw stored === 0 ? storageNotFound() : storageConflict(stored);
		},
	};
}

/** What a migration step sees: the same collections, inside the step's transaction, plus the plugin's old tables. */
function migrationOf(client: PoolClient, qSchema: string, plugin: string): PluginMigration {
	return {
		collection: (name) => collectionOf(client, qSchema, plugin, name),
		importItem: async (collection, item) => {
			assertStorageName("collection", collection);
			assertStorageKey(item.key);
			assertStoredVersion(item.version ?? 1);
			const createdAt = item.createdAt ?? new Date();
			const res = await client.query(
				`INSERT INTO "${qSchema}".plugin_documents (plugin, collection, key, value, version, created_at, updated_at)
				 VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
				 ON CONFLICT (plugin, collection, key) DO NOTHING`,
				[
					plugin,
					collection,
					item.key,
					serializeStorageValue(item.value),
					item.version ?? 1,
					createdAt,
					item.updatedAt ?? createdAt,
				],
			);
			return res.rowCount === 1;
		},
		readLegacyTable: async (table) => {
			if (!/^[a-z_][a-z0-9_]*$/.test(table)) return null;
			const exists = await client.query<{ found: string | null }>(`SELECT to_regclass($1)::text AS found`, [
				`"${qSchema}"."${table}"`,
			]);
			if (!exists.rows[0]?.found) return null;
			return (await client.query<Record<string, unknown>>(`SELECT * FROM "${qSchema}"."${table}"`)).rows;
		},
	};
}

/** Records of one-time steps share the core migration log. A plugin's step is recorded as `plugin:<plugin>:<name>`. */
const stepRecord = (plugin: string, name: string) => `plugin:${plugin}:${name}`;

/** The storage of one plugin in a Postgres schema. The `plugin_documents` table is created by the core migrations (`monti migrate`). */
export function createPluginStorage(pool: Pool, schema: string | undefined, plugin: string): PluginStorage {
	assertStorageName("plugin", plugin);
	const qSchema = validateSchemaName(schema);
	return {
		plugin,
		collection: (name) => collectionOf(pool, qSchema, plugin, name),
		once: async (name, step, options) => {
			assertMigrationName(name);
			let ran = false;
			await (await loadSchemaModule()).runOnce(pool, { schema: qSchema }, stepRecord(plugin, name), async (client) => {
				if (options?.legacyNames?.length) {
					const done = await client.query(`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = ANY($1::text[])`, [
						[...options.legacyNames],
					]);
					// An earlier version already did this work: the step counts as done, and its record is kept for next time.
					if (done.rows.length > 0) return;
				}
				await step(migrationOf(client, qSchema, plugin));
				ran = true;
			});
			return ran;
		},
	};
}

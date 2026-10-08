import { sql } from "kysely";
import { assertExpectedVersionNumber, assertMigrationName, assertStorageKey, assertStorageName, assertStoredVersion, serializeStorageValue, storageConflict, storageNotFound, } from "../../core/domain/plugin-storage.js";
import { createDb, dbOn } from "./db/kysely.js";
import { validateSchemaName } from "./store/context.js";
/** The migration code is loaded when a step runs, not when the adapter is created. */
const loadSchemaModule = () => import("./store/schema.js");
const COLUMNS = ["key", "value", "version", "created_at", "updated_at"];
const toItem = (row) => ({
    key: row.key,
    value: row.value,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/** The value as a `jsonb` parameter: the JSON text, cast on the server like every write of this table always did. */
const jsonb = (json) => sql `${json}::jsonb`;
const now = () => sql `now()`;
/** One collection of one plugin over a `Db` (on the pool, or on the client of a migration step's transaction). */
function collectionOf(db, plugin, name) {
    assertStorageName("collection", name);
    const documents = () => db.selectFrom("plugin_documents").where("plugin", "=", plugin).where("collection", "=", name);
    const storedVersion = async (key) => (await documents().select("version").where("key", "=", key).executeTakeFirst())?.version ?? 0;
    return {
        get: async (key) => {
            assertStorageKey(key);
            const row = await documents().select(COLUMNS).where("key", "=", key).executeTakeFirst();
            return row ? toItem(row) : null;
        },
        list: async (options) => {
            let query = documents().select(COLUMNS);
            if (options?.prefix)
                query = query.where(sql `starts_with(key, ${options.prefix})`);
            const rows = await query.orderBy(sql `key collate "C"`).execute();
            return rows.map((row) => toItem(row));
        },
        // Each write is one statement, so two writers that expect the same version cannot both succeed.
        set: async (key, value, { expectedVersion }) => {
            assertStorageKey(key);
            assertExpectedVersionNumber(expectedVersion);
            const json = serializeStorageValue(value);
            const row = expectedVersion === 0
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
                    .set({ value: jsonb(json), version: sql `version + 1`, updated_at: now() })
                    .where("plugin", "=", plugin)
                    .where("collection", "=", name)
                    .where("key", "=", key)
                    .where("version", "=", expectedVersion)
                    .returning(COLUMNS)
                    .executeTakeFirst();
            if (!row)
                throw storageConflict(await storedVersion(key));
            return toItem(row);
        },
        delete: async (key, { expectedVersion }) => {
            assertStorageKey(key);
            assertExpectedVersionNumber(expectedVersion);
            const res = await db
                .deleteFrom("plugin_documents")
                .where("plugin", "=", plugin)
                .where("collection", "=", name)
                .where("key", "=", key)
                .where("version", "=", expectedVersion)
                .executeTakeFirst();
            if (res.numDeletedRows === 1n)
                return;
            const stored = await storedVersion(key);
            throw stored === 0 ? storageNotFound() : storageConflict(stored);
        },
    };
}
/** What a migration step sees: the same collections, inside the step's transaction, plus the plugin's old tables. */
function migrationOf(client, qSchema, plugin) {
    const db = dbOn(client, qSchema);
    return {
        collection: (name) => collectionOf(db, plugin, name),
        importItem: async (collection, item) => {
            assertStorageName("collection", collection);
            assertStorageKey(item.key);
            assertStoredVersion(item.version ?? 1);
            const createdAt = item.createdAt ?? new Date();
            const res = await db
                .insertInto("plugin_documents")
                .values({
                plugin,
                collection,
                key: item.key,
                value: jsonb(serializeStorageValue(item.value)),
                version: item.version ?? 1,
                created_at: createdAt,
                updated_at: item.updatedAt ?? createdAt,
            })
                .onConflict((conflict) => conflict.columns(["plugin", "collection", "key"]).doNothing())
                .executeTakeFirst();
            return res.numInsertedOrUpdatedRows === 1n;
        },
        readLegacyTable: async (table) => {
            if (!/^[a-z_][a-z0-9_]*$/.test(table))
                return null;
            // A table of the plugin's own is not in `Database`, so it is read with `sql`, which `withSchema` does not touch: the schema is named in the identifier.
            const exists = await sql `select to_regclass(${`"${qSchema}"."${table}"`})::text as found`.execute(db);
            if (!exists.rows[0]?.found)
                return null;
            return (await sql `select * from ${sql.id(qSchema, table)}`.execute(db)).rows;
        },
    };
}
/** Records of one-time steps share the core migration log. A plugin's step is recorded as `plugin:<plugin>:<name>`. */
const stepRecord = (plugin, name) => `plugin:${plugin}:${name}`;
/** The storage of one plugin in a Postgres schema. The `plugin_documents` table is created by the core migrations (`monti migrate`). */
export function createPluginStorage(pool, schema, plugin) {
    assertStorageName("plugin", plugin);
    const qSchema = validateSchemaName(schema);
    const db = createDb(pool, qSchema);
    return {
        plugin,
        collection: (name) => collectionOf(db, plugin, name),
        once: async (name, step, options) => {
            assertMigrationName(name);
            let ran = false;
            await (await loadSchemaModule()).runOnce(pool, { schema: qSchema }, stepRecord(plugin, name), async (client) => {
                if (options?.legacyNames?.length) {
                    const done = await dbOn(client, qSchema)
                        .selectFrom("cms_migrations")
                        .select("name")
                        .where("name", "in", [...options.legacyNames])
                        .limit(1)
                        .executeTakeFirst();
                    // An earlier version already did this work: the step counts as done, and its record is kept for next time.
                    if (done)
                        return;
                }
                await step(migrationOf(client, qSchema, plugin));
                ran = true;
            });
            return ran;
        },
    };
}

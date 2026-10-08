import { assertExpectedVersionNumber, assertMigrationName, assertStorageKey, assertStorageName, assertStoredVersion, serializeStorageValue, storageConflict, storageNotFound, } from "../core/domain/plugin-storage.js";
export function createMemoryPluginStorage() {
    /** `plugin/collection` to its documents. */
    const collections = new Map();
    const recorded = new Set();
    const legacyTables = new Map();
    /** Serializes `once`, like the database lock does, so concurrent calls run a step once. */
    let queue = Promise.resolve();
    const documents = (plugin, collection) => {
        const id = `${plugin}/${collection}`;
        let found = collections.get(id);
        if (!found) {
            found = new Map();
            collections.set(id, found);
        }
        return found;
    };
    const parse = (text) => JSON.parse(text);
    const copy = (item) => ({
        ...item,
        value: parse(JSON.stringify(item.value)),
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
    });
    const collectionOf = (plugin, name) => {
        assertStorageName("collection", name);
        return {
            get: async (key) => {
                assertStorageKey(key);
                const item = documents(plugin, name).get(key);
                return item ? copy(item) : null;
            },
            list: async (options) => [...documents(plugin, name).values()]
                .filter((item) => !options?.prefix || item.key.startsWith(options.prefix))
                .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
                .map((item) => copy(item)),
            set: async (key, value, { expectedVersion }) => {
                assertStorageKey(key);
                assertExpectedVersionNumber(expectedVersion);
                const text = serializeStorageValue(value);
                const stored = documents(plugin, name);
                const current = stored.get(key);
                if ((current?.version ?? 0) !== expectedVersion)
                    throw storageConflict(current?.version ?? 0);
                const now = new Date();
                const next = {
                    key,
                    value: parse(text),
                    version: expectedVersion + 1,
                    createdAt: current?.createdAt ?? now,
                    updatedAt: now,
                };
                stored.set(key, next);
                return copy(next);
            },
            delete: async (key, { expectedVersion }) => {
                assertStorageKey(key);
                assertExpectedVersionNumber(expectedVersion);
                const stored = documents(plugin, name);
                const current = stored.get(key);
                if (!current)
                    throw storageNotFound();
                if (current.version !== expectedVersion)
                    throw storageConflict(current.version);
                stored.delete(key);
            },
        };
    };
    const migrationOf = (plugin) => ({
        collection: (name) => collectionOf(plugin, name),
        importItem: async (collection, item) => {
            assertStorageName("collection", collection);
            assertStorageKey(item.key);
            assertStoredVersion(item.version ?? 1);
            const stored = documents(plugin, collection);
            if (stored.has(item.key))
                return false;
            const createdAt = item.createdAt ?? new Date();
            stored.set(item.key, {
                key: item.key,
                value: parse(serializeStorageValue(item.value)),
                version: item.version ?? 1,
                createdAt,
                updatedAt: item.updatedAt ?? createdAt,
            });
            return true;
        },
        readLegacyTable: async (table) => {
            const rows = legacyTables.get(table);
            return rows ? rows.map((row) => ({ ...row })) : null;
        },
    });
    const storage = (plugin) => {
        assertStorageName("plugin", plugin);
        return {
            plugin,
            collection: (name) => collectionOf(plugin, name),
            once: (name, step, options) => {
                assertMigrationName(name);
                const run = async () => {
                    const id = `${plugin}:${name}`;
                    if (recorded.has(id) || options?.legacyNames?.some((legacy) => recorded.has(legacy)))
                        return false;
                    // A step that throws leaves nothing behind: put the data back as it was.
                    const before = new Map([...collections].map(([key, docs]) => [key, new Map(docs)]));
                    try {
                        await step(migrationOf(plugin));
                    }
                    catch (error) {
                        collections.clear();
                        for (const [key, docs] of before)
                            collections.set(key, docs);
                        throw error;
                    }
                    recorded.add(id);
                    return true;
                };
                const result = queue.then(run, run);
                queue = result.catch(() => undefined);
                return result;
            },
        };
    };
    return {
        storage,
        seedLegacyTable: (table, rows) => {
            legacyTables.set(table, rows);
        },
        recordMigration: (name) => {
            recorded.add(name);
        },
    };
}

import {
	assertExpectedVersionNumber,
	assertMigrationName,
	assertStorageKey,
	assertStorageName,
	assertStoredVersion,
	serializeStorageValue,
	storageConflict,
	storageNotFound,
} from "../core/domain/plugin-storage";
import type { PluginCollection, PluginMigration, PluginStorage, StorageItem, StorageWriteOptions } from "./storage";

/**
 * Plugin storage in memory: for plugin tests, and for `fakeCms` when a test does not bring a database. It follows the same contract as the
 * database-backed storage (`plugin/__test__/storage-contract.ts`), values go through JSON as they do there, and nothing outlives the object.
 */
export interface MemoryPluginStorage {
	/** The storage of one plugin. The same plugin name gives the same data. */
	storage(plugin: string): PluginStorage;
	/**
	 * Runs `work` and keeps what it wrote only if it does not throw (the data is put back as it was otherwise), like a database transaction. `once` is not available inside it.
	 */
	transaction<T>(work: (tx: { pluginStorage(plugin: string): PluginStorage }) => Promise<T>): Promise<T>;
}

type Documents = Map<string, StorageItem>;

export function createMemoryPluginStorage(): MemoryPluginStorage {
	/** `plugin/collection` to its documents. */
	const collections = new Map<string, Documents>();
	const recorded = new Set<string>();
	/** Serializes `once`, like the database lock does, so concurrent calls run a step once. */
	let queue: Promise<unknown> = Promise.resolve();

	const documents = (plugin: string, collection: string): Documents => {
		const id = `${plugin}/${collection}`;
		let found = collections.get(id);
		if (!found) {
			found = new Map();
			collections.set(id, found);
		}
		return found;
	};
	const parse = <T>(text: string): T => JSON.parse(text) as T;
	const copy = <T>(item: StorageItem): StorageItem<T> => ({
		...item,
		value: parse<T>(JSON.stringify(item.value)),
		createdAt: new Date(item.createdAt),
		updatedAt: new Date(item.updatedAt),
	});

	const collectionOf = <T>(plugin: string, name: string): PluginCollection<T> => {
		assertStorageName("collection", name);
		return {
			get: async (key) => {
				assertStorageKey(key);
				const item = documents(plugin, name).get(key);
				return item ? copy<T>(item) : null;
			},
			list: async (options) =>
				[...documents(plugin, name).values()]
					.filter((item) => !options?.prefix || item.key.startsWith(options.prefix))
					.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
					.map((item) => copy<T>(item)),
			set: async (key, value, { expectedVersion }: StorageWriteOptions) => {
				assertStorageKey(key);
				assertExpectedVersionNumber(expectedVersion);
				const text = serializeStorageValue(value);
				const stored = documents(plugin, name);
				const current = stored.get(key);
				if ((current?.version ?? 0) !== expectedVersion) throw storageConflict(current?.version ?? 0);
				const now = new Date();
				const next: StorageItem = {
					key,
					value: parse(text),
					version: expectedVersion + 1,
					createdAt: current?.createdAt ?? now,
					updatedAt: now,
				};
				stored.set(key, next);
				return copy<T>(next);
			},
			delete: async (key, { expectedVersion }: StorageWriteOptions) => {
				assertStorageKey(key);
				assertExpectedVersionNumber(expectedVersion);
				const stored = documents(plugin, name);
				const current = stored.get(key);
				if (!current) throw storageNotFound();
				if (current.version !== expectedVersion) throw storageConflict(current.version);
				stored.delete(key);
			},
		};
	};

	const migrationOf = (plugin: string): PluginMigration => ({
		collection: (name) => collectionOf(plugin, name),
	});

	const storage = (plugin: string): PluginStorage => {
		assertStorageName("plugin", plugin);
		return {
			plugin,
			collection: (name) => collectionOf(plugin, name),
			once: (name, step) => {
				assertMigrationName(name);
				const run = async (): Promise<boolean> => {
					const id = `${plugin}:${name}`;
					if (recorded.has(id)) return false;
					// A step that throws leaves nothing behind: put the data back as it was.
					const before = new Map([...collections].map(([key, docs]) => [key, new Map(docs)]));
					try {
						await step(migrationOf(plugin));
					} catch (error) {
						collections.clear();
						for (const [key, docs] of before) collections.set(key, docs);
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

	/** Transactions run one at a time, like writers waiting on a database lock, so one that fails cannot undo what another wrote. */
	let transactions: Promise<unknown> = Promise.resolve();
	const transaction: MemoryPluginStorage["transaction"] = (work) => {
		const run = async () => {
			const before = new Map([...collections].map(([key, docs]) => [key, new Map(docs)]));
			try {
				return await work({
					pluginStorage: (plugin) => ({
						...storage(plugin),
						once: async () => {
							throw new Error("plugin storage: `once` cannot run inside a transaction");
						},
					}),
				});
			} catch (error) {
				collections.clear();
				for (const [key, docs] of before) collections.set(key, docs);
				throw error;
			}
		};
		const result = transactions.then(run, run);
		transactions = result.catch(() => undefined);
		return result;
	};

	return {
		storage,
		transaction,
	};
}

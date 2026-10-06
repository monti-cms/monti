/**
 * Plugin storage: the small namespaced store a plugin keeps its own data in (settings, per-entry sync state, cached results), instead of its own
 * database tables. The instance hands each plugin one, already scoped to the plugin's name: `cms.storage("my-plugin")`. Whatever the database
 * behind the instance is, the plugin sees documents grouped in named collections, and no database driver.
 *
 * ```ts
 * const settings = cms.storage("my-plugin").collection<{ endpoint: string }>("settings");
 * const saved = await settings.set("default", { endpoint: "https://…" }, { expectedVersion: 0 }); // create
 * await settings.set("default", { endpoint: "https://…/v2" }, { expectedVersion: saved.version }); // replace
 * ```
 *
 * Values are JSON: they are stored as JSON and come back as parsed JSON, so a `Date` or `undefined` inside a value does not survive.
 */

/** One stored document. */
export interface StorageItem<T = unknown> {
	readonly key: string;
	readonly value: T;
	/** 1 when created, and one more on every write. Pass it back as `expectedVersion` to replace or delete the item. */
	readonly version: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** Writes take the version they expect to find, so two editors cannot overwrite each other unnoticed. */
export interface StorageWriteOptions {
	/** 0 to create the item, otherwise the version the caller last read. A different stored version fails with a `CmsError` coded `conflict` that carries the stored one (0 when there is none). */
	readonly expectedVersion: number;
}

/** A named group of documents of one plugin, keyed by string. */
export interface PluginCollection<T = unknown> {
	/** The item, or `null` when there is none. */
	get(key: string): Promise<StorageItem<T> | null>;
	/** Every item (or the ones whose key starts with `prefix`), in key order. */
	list(options?: { readonly prefix?: string }): Promise<StorageItem<T>[]>;
	/** Creates (`expectedVersion` 0) or replaces an item. Atomic: of two writers that expect the same version, one wins and the other gets `conflict`. */
	set(key: string, value: T, options: StorageWriteOptions): Promise<StorageItem<T>>;
	/** Deletes an item. `not_found` when there is none, `conflict` when the version differs. */
	delete(key: string, options: StorageWriteOptions): Promise<void>;
}

/** An item as it was before the plugin used this storage (see {@link PluginMigration.importItem}). */
export interface ImportedItem<T = unknown> {
	readonly key: string;
	readonly value: T;
	/** Defaults to 1. */
	readonly version?: number;
	/** Default: now. */
	readonly createdAt?: Date;
	/** Default: `createdAt`. */
	readonly updatedAt?: Date;
}

/** What one step of {@link PluginStorage.once} can do. All of it happens in one transaction: if the step throws, none of it is kept. */
export interface PluginMigration {
	collection<T = unknown>(name: string): PluginCollection<T>;
	/**
	 * Adds an item with the version and dates it had, unless the key already exists (an existing item is never overwritten).
	 * @returns whether the item was added
	 */
	importItem<T>(collection: string, item: ImportedItem<T>): Promise<boolean>;
	/**
	 * Rows of a table an earlier version of the plugin kept in the same database before it used this storage, as plain objects (column name to value),
	 * or `null` when there is no such table. The table is only read, never changed or dropped.
	 */
	readLegacyTable(table: string): Promise<Record<string, unknown>[] | null>;
}

/** The storage of one plugin. */
export interface PluginStorage {
	/** The plugin this storage belongs to. Another plugin's collections are not reachable from it. */
	readonly plugin: string;
	/** A collection by name (lowercase letters, digits and `-`, starting with a letter). It exists as soon as an item is written to it. */
	collection<T = unknown>(name: string): PluginCollection<T>;
	/**
	 * The migration hook: runs `step` once and records `name` (per plugin) so it does not run again, also when called concurrently. Use it to move data from an earlier
	 * layout, e.g. out of tables the plugin used to create itself. If `step` throws nothing is recorded and the next call runs it again.
	 * `legacyNames` are names under which an earlier version already recorded the same work: if one of them is recorded, the step counts as done.
	 * @returns whether it ran this time
	 */
	once(
		name: string,
		step: (migration: PluginMigration) => Promise<void>,
		options?: { readonly legacyNames?: readonly string[] },
	): Promise<boolean>;
}

/**
 * Plugin storage: the small namespaced store a plugin keeps its own data in (settings, per-entry sync state, cached results), instead of its own
 * database tables. The instance hands each plugin one, already scoped to the plugin's name: `plugin.storage` in its routes, hooks and commands (`cms.plugin("my-plugin").storage` elsewhere). Whatever the database
 * behind the instance is, the plugin sees documents grouped in named collections, and no database driver.
 *
 * ```ts
 * const settings = plugin.storage.collection<{ endpoint: string }>("settings");
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
    list(options?: {
        readonly prefix?: string;
    }): Promise<StorageItem<T>[]>;
    /** Creates (`expectedVersion` 0) or replaces an item. Atomic: of two writers that expect the same version, one wins and the other gets `conflict`. */
    set(key: string, value: T, options: StorageWriteOptions): Promise<StorageItem<T>>;
    /** Deletes an item. `not_found` when there is none, `conflict` when the version differs. */
    delete(key: string, options: StorageWriteOptions): Promise<void>;
}
/** What one step of {@link PluginStorage.once} can do. All of it happens in one transaction: if the step throws, none of it is kept. */
export interface PluginMigration {
    collection<T = unknown>(name: string): PluginCollection<T>;
}
/** The storage of one plugin. */
export interface PluginStorage {
    /** The plugin this storage belongs to. Another plugin's collections are not reachable from it. */
    readonly plugin: string;
    /** A collection by name (lowercase letters, digits and `-`, starting with a letter). It exists as soon as an item is written to it. */
    collection<T = unknown>(name: string): PluginCollection<T>;
    /**
     * The migration hook: runs `step` once and records `name` (per plugin) so it does not run again, also when called concurrently. If `step` throws nothing is
     * recorded and the next call runs it again.
     * @returns whether it ran this time
     */
    once(name: string, step: (migration: PluginMigration) => Promise<void>): Promise<boolean>;
}

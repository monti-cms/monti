import type { PluginStorage } from "./storage.js";
/**
 * Plugin storage in memory: for plugin tests, and for `fakeCms` when a test does not bring a database. It follows the same contract as the
 * database-backed storage (`plugin/__test__/storage-contract.ts`), values go through JSON as they do there, and nothing outlives the object.
 */
export interface MemoryPluginStorage {
    /** The storage of one plugin. The same plugin name gives the same data. */
    storage(plugin: string): PluginStorage;
    /** Puts a table an earlier version of a plugin kept on its own where `readLegacyTable` can read it (for migration tests). */
    seedLegacyTable(table: string, rows: readonly Record<string, unknown>[]): void;
    /** Records a one-time step name as done, as an earlier version of a plugin would have (for `legacyNames` tests). */
    recordMigration(name: string): void;
}
export declare function createMemoryPluginStorage(): MemoryPluginStorage;

import type { PluginStorage } from "./storage.js";
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
    transaction<T>(work: (tx: {
        pluginStorage(plugin: string): PluginStorage;
    }) => Promise<T>): Promise<T>;
}
export declare function createMemoryPluginStorage(): MemoryPluginStorage;

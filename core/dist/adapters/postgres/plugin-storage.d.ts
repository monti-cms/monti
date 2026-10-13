import type { Pool } from "pg";
import type { PluginStorage } from "../../plugin/storage.js";
/** The storage of one plugin in a Postgres schema. The `plugin_documents` table is created by the core migrations (`monti db:migrate`). */
export declare function createPluginStorage(pool: Pool, schema: string | undefined, plugin: string): PluginStorage;
/**
 * Runs `work` in one transaction. The storage it hands out reads and writes through the transaction's client, for any plugin, so a write to one plugin's collection and
 * one to another's (the core key store and a plugin's settings) are kept or dropped together. `once` is not available inside it.
 */
export declare function inPluginTransaction<T>(pool: Pool, schema: string | undefined, work: (tx: {
    pluginStorage(plugin: string): PluginStorage;
}) => Promise<T>): Promise<T>;

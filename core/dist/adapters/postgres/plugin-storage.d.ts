import type { Pool } from "pg";
import type { PluginStorage } from "../../plugin/storage.js";
/** The storage of one plugin in a Postgres schema. The `plugin_documents` table is created by the core migrations (`monti migrate`). */
export declare function createPluginStorage(pool: Pool, schema: string | undefined, plugin: string): PluginStorage;

import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
/**
 * Moves the service keys stored inside the AI connections into the central API key store, once: each distinct key becomes a key named after the first connection
 * that uses it (`Name 2` if taken), connections that shared one key keep sharing it, and the connection keeps only the key's id. A key that cannot be decrypted
 * any more (the server `secret` changed without `previousSecrets`) cannot be moved: its connection is left without a key and needs one entered again.
 * Safe to repeat: a row that already holds ids is left alone, and a value already in the store is reused instead of added again.
 */
export declare function moveKeysToStore(storage: PluginStorage, cms: Cms): Promise<number>;
/**
 * AI plugin migration. `monti db:migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly.
 *
 * Data from before the storage API is moved once: the three tables the plugin used to create itself (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`)
 * are copied into the plugin's collections with their versions and dates, and the old tables stay where they are, untouched.
 * Service keys stored inside the connections are then moved into the central API key store.
 */
export declare function migrateAi(storage: PluginStorage, cms: Cms): Promise<void>;

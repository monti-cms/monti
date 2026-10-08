import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
/**
 * AI plugin migration. `monti migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly.
 *
 * Data from before the storage API is moved once: the three tables the plugin used to create itself (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`)
 * are copied into the plugin's collections with their versions and dates, and the old tables stay where they are, untouched.
 */
export declare function migrateAi(storage: PluginStorage, cms: Cms): Promise<void>;

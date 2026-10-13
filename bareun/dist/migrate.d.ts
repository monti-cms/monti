import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
/**
 * `monti db:migrate`: moves what earlier versions kept into the plugin's key slot. Safe to repeat.
 * 1. The old settings item (`settings/default`, `{ keyId }`) is assigned to the slot when the slot is empty and the key still exists, and removed.
 * 2. Without an old settings item and while the slot is empty, the environment variable `BAREUN_API_KEY` becomes the key "Bareun" (reusing a key with the same value) and is assigned.
 */
export declare function adoptLegacyKey(storage: PluginStorage, cms: Cms): Promise<void>;

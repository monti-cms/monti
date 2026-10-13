import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
/**
 * Moves the GitHub token to the plugin's key slot, once. The settings used to hold the token themselves (`token`, ciphertext under `cms.secrets("git-sync")`) and,
 * after that, the id of a key of the API key store (`tokenKeyId`). Either becomes the key assigned to the `token` slot, and the settings keep only the webhook secret:
 * an old token is saved as a key named `GitHub` (`GitHub 2` if taken), or an existing key with the same value is reused. A token that cannot be decrypted any more
 * (the server `secret` changed without `previousSecrets`) cannot be moved: the settings are left as they are, with a warning, and the token has to be chosen again in the admin.
 * Safe to repeat: settings without the old fields are left alone, a slot that has a key already is not changed, and a value already in the store is reused.
 *
 * The old shapes are read only here, loosely; everything else reads the new one.
 */
export declare function moveTokenToSlot(storage: PluginStorage, cms: Cms): Promise<number>;
/** Git sync migration. `monti db:migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly. */
export declare function migrateGitSync(storage: PluginStorage, cms: Cms): Promise<void>;

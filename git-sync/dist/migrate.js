import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options.js";
import { tokenKeyOf } from "./settings.js";
import { COLLECTIONS } from "./state.js";
/**
 * Moves the GitHub token to the plugin's key slot, once. The settings used to hold the token themselves (`token`, ciphertext under `cms.secrets("git-sync")`) and,
 * after that, the id of a key of the API key store (`tokenKeyId`). Either becomes the key assigned to the `token` slot, and the settings keep only the webhook secret:
 * an old token is saved as a key named `GitHub` (`GitHub 2` if taken), or an existing key with the same value is reused. A token that cannot be decrypted any more
 * (the server `secret` changed without `previousSecrets`) cannot be moved: the settings are left as they are, with a warning, and the token has to be chosen again in the admin.
 * Safe to repeat: settings without the old fields are left alone, a slot that has a key already is not changed, and a value already in the store is reused.
 *
 * The old shapes are read only here, loosely; everything else reads the new one.
 */
export async function moveTokenToSlot(storage, cms) {
    if (!cms.apiKeys.available)
        return 0;
    const settings = storage.collection(COLLECTIONS.settings);
    const row = await settings.get("default");
    if (!row || !("token" in row.value || "tokenKeyId" in row.value))
        return 0;
    const { token, tokenKeyId, ...rest } = row.value;
    const oldToken = typeof token === "string" && token !== "" ? token : null;
    const oldKeyId = typeof tokenKeyId === "string" && tokenKeyId !== "" ? tokenKeyId : null;
    let added = 0;
    // A key assigned to the slot already wins over what the old settings say.
    if (!(await tokenKeyOf(cms))) {
        let keyId = oldKeyId && (await cms.apiKeys.get(oldKeyId)) ? oldKeyId : null;
        if (!keyId && oldToken) {
            const plain = cms.secrets(GIT_SYNC_PLUGIN_NAME).decrypt(oldToken);
            if (plain === null) {
                console.warn("[git-sync] the saved GitHub token cannot be decrypted, so it was not moved to the API keys; choose it again on the Git sync screen");
                return 0;
            }
            for (const key of await cms.apiKeys.list()) {
                if ((await cms.apiKeys.read(key.id)) === plain) {
                    keyId = key.id;
                    break;
                }
            }
            if (!keyId) {
                keyId = (await cms.apiKeys.addNamed({ baseName: "GitHub", value: plain })).id;
                added = 1;
            }
        }
        if (keyId)
            await cms.apiKeys.setSlot(GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT, keyId);
    }
    try {
        await settings.set("default", rest, { expectedVersion: row.version });
    }
    catch (error) {
        // A save of the settings raced with this and wrote the new shape already.
        if (error.code === "conflict")
            return added;
        throw error;
    }
    return added;
}
/** Git sync migration. `monti db:migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly. */
export async function migrateGitSync(storage, cms) {
    await moveTokenToSlot(storage, cms);
}

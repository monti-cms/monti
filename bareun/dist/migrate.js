import { BAREUN_KEY_SLOT, BAREUN_PLUGIN_NAME } from "./options.js";
const BASE_NAME = "Bareun";
const slotIsEmpty = async (cms) => {
    if ((await cms.apiKeys.readSlot(BAREUN_PLUGIN_NAME, BAREUN_KEY_SLOT)) !== null)
        return false;
    const slot = (await cms.apiKeys.slots()).find((entry) => entry.plugin === BAREUN_PLUGIN_NAME && entry.slot === BAREUN_KEY_SLOT);
    // Not listed: the plugin is not in the site config, so there is no slot to fill.
    return slot !== undefined && slot.key === null;
};
/**
 * `monti db:migrate`: moves what earlier versions kept into the plugin's key slot. Safe to repeat.
 * 1. The old settings item (`settings/default`, `{ keyId }`) is assigned to the slot when the slot is empty and the key still exists, and removed.
 * 2. Without an old settings item and while the slot is empty, the environment variable `BAREUN_API_KEY` becomes the key "Bareun" (reusing a key with the same value) and is assigned.
 */
export async function adoptLegacyKey(storage, cms) {
    if (!cms.apiKeys.available)
        return;
    const settings = storage.collection("settings");
    const legacy = await settings.get("default");
    if (legacy) {
        const keyId = legacy.value.keyId;
        if (keyId && (await slotIsEmpty(cms)) && (await cms.apiKeys.get(keyId))) {
            await cms.apiKeys.setSlot(BAREUN_PLUGIN_NAME, BAREUN_KEY_SLOT, keyId);
        }
        await settings.delete("default", { expectedVersion: legacy.version });
        // The old page was used (even to choose no key), so the environment variable is not adopted over that choice.
        return;
    }
    const env = process.env.BAREUN_API_KEY?.trim();
    if (!env || !(await slotIsEmpty(cms)))
        return;
    let keyId;
    for (const key of await cms.apiKeys.list()) {
        if ((await cms.apiKeys.read(key.id)) === env) {
            keyId = key.id;
            break;
        }
    }
    keyId ??= (await cms.apiKeys.addNamed({ baseName: BASE_NAME, value: env })).id;
    await cms.apiKeys.setSlot(BAREUN_PLUGIN_NAME, BAREUN_KEY_SLOT, keyId);
}

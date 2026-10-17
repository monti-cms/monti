import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT, GIT_SYNC_WEBHOOK_SLOT } from "./options.js";
/** The key assigned to one of the plugin's slots, or `null` when none is. */
export async function slotKeyOf(cms, slot) {
    const slots = await cms.apiKeys.slots();
    return slots.find((entry) => entry.plugin === GIT_SYNC_PLUGIN_NAME && entry.slot === slot)?.key ?? null;
}
export const tokenKeyOf = (cms) => slotKeyOf(cms, GIT_SYNC_TOKEN_SLOT);
export async function keysView(cms) {
    const [token, webhookSecret] = await Promise.all([tokenKeyOf(cms), slotKeyOf(cms, GIT_SYNC_WEBHOOK_SLOT)]);
    return { secretsAvailable: cms.apiKeys.available, token, webhookSecret };
}
/** The webhook secret, or `null` when none is assigned (or it cannot be read). */
export const readWebhookSecret = (cms) => cms.plugin(GIT_SYNC_PLUGIN_NAME).key(GIT_SYNC_WEBHOOK_SLOT).read();

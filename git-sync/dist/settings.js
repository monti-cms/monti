import { CmsError, problemText } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options.js";
const secretsOf = (ctx) => ctx.cms.secrets(GIT_SYNC_PLUGIN_NAME);
/** The key assigned to the plugin's token slot, or `null` when none is. */
export async function tokenKeyOf(cms) {
    const slots = await cms.apiKeys.slots();
    return slots.find((slot) => slot.plugin === GIT_SYNC_PLUGIN_NAME && slot.slot === GIT_SYNC_TOKEN_SLOT)?.key ?? null;
}
export async function settingsView(ctx) {
    const secrets = secretsOf(ctx);
    const item = await ctx.state.settings.get();
    const webhookSecret = item?.value.webhookSecret ? secrets.decrypt(item.value.webhookSecret) : null;
    return {
        secretsAvailable: secrets.available && ctx.cms.apiKeys.available,
        token: { key: await tokenKeyOf(ctx.cms) },
        webhookSecret: {
            set: Boolean(item?.value.webhookSecret),
            readable: !item?.value.webhookSecret || webhookSecret !== null,
        },
        version: item?.version ?? 0,
    };
}
export async function saveSettings(ctx, patch) {
    const secrets = secretsOf(ctx);
    if (!secrets.available) {
        throw new CmsError(problemText({
            what: "MONTI_SECRET is not set, so a webhook secret cannot be stored",
            where: ".env.local (and the environment settings of your host), or `secret` in defineConfig",
            fix: "set it to a long random value (`openssl rand -base64 32`), restart the server, then save the secret again",
        }), "secret_not_configured");
    }
    const current = (await ctx.state.settings.get())?.value;
    const webhookSecret = patch.webhookSecret === undefined
        ? (current?.webhookSecret ?? null)
        : patch.webhookSecret === null || patch.webhookSecret.trim() === ""
            ? null
            : secrets.encrypt(patch.webhookSecret.trim());
    const next = { webhookSecret };
    await ctx.state.settings.save(next, patch.expectedVersion);
    return settingsView(ctx);
}
/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export async function readWebhookSecret(ctx) {
    const stored = (await ctx.state.settings.get())?.value.webhookSecret;
    return stored ? secretsOf(ctx).decrypt(stored) : null;
}

import { CmsError, problemText } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME } from "./options.js";
const secretsOf = (ctx) => ctx.cms.secrets(GIT_SYNC_PLUGIN_NAME);
export async function settingsView(ctx) {
    const secrets = secretsOf(ctx);
    const item = await ctx.state.settings.get();
    const token = item?.value.token ? secrets.decrypt(item.value.token) : null;
    const webhookSecret = item?.value.webhookSecret ? secrets.decrypt(item.value.webhookSecret) : null;
    return {
        secretsAvailable: secrets.available,
        token: {
            set: Boolean(item?.value.token),
            hint: token ? `…${token.slice(-4)}` : null,
            readable: !item?.value.token || token !== null,
        },
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
            what: "MONTI_SECRET is not set, so a token cannot be stored",
            where: ".env.local (and the environment settings of your host), or `secret` in defineConfig",
            fix: "set it to a long random value (`openssl rand -base64 32`), restart the server, then save the token again",
        }), "secret_not_configured");
    }
    const current = (await ctx.state.settings.get())?.value;
    const encrypt = (value, kept) => value === undefined ? (kept ?? null) : value === null || value.trim() === "" ? null : secrets.encrypt(value.trim());
    const next = {
        token: encrypt(patch.token, current?.token),
        webhookSecret: encrypt(patch.webhookSecret, current?.webhookSecret),
    };
    await ctx.state.settings.save(next, patch.expectedVersion);
    return settingsView(ctx);
}
/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export async function readWebhookSecret(ctx) {
    const stored = (await ctx.state.settings.get())?.value.webhookSecret;
    return stored ? secretsOf(ctx).decrypt(stored) : null;
}

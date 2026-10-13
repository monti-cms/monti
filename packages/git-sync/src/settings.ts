import type { ApiKeyView } from "@monti-cms/core/client";
import { type Cms, CmsError, problemText } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options";
import type { StoredSettings } from "./state";
import type { SyncContext } from "./sync";

/**
 * The GitHub token is a key of the central API key store (`cms.apiKeys`) assigned to the plugin's `token` slot: the plugin reads the value from the store when it
 * calls GitHub. The secret the push webhook is signed with is the plugin's own: it is set on the plugin's admin screen, never in config, and saved in the plugin's
 * storage encrypted with the plugin's own key (`cms.secrets("git-sync")`, derived from the server config's `secret`). Neither is ever sent back to the browser: the
 * screen learns the token's key by name and last four characters, and only whether the webhook secret is set.
 */

/** The key of the store the token comes from, as the admin screen shows it. */
export type TokenKeyView = Pick<ApiKeyView, "id" | "name" | "tail" | "readable">;

/** What the admin screen learns about the saved settings. */
export interface SettingsView {
	/** Whether the server config has a `secret`: without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	/** The key assigned to the token slot, or `null` when none is (or the key was deleted: that is the same as no token yet). */
	readonly token: { readonly key: TokenKeyView | null };
	readonly webhookSecret: { readonly set: boolean; readonly readable: boolean };
	/** Version of the saved settings (0 when nothing is saved yet). Sent back when saving. */
	readonly version: number;
}

export interface SettingsPatch {
	/** A new webhook secret, `null` to forget it, absent to keep it. */
	readonly webhookSecret?: string | null;
	readonly expectedVersion: number;
}

const secretsOf = (ctx: SyncContext) => ctx.cms.secrets(GIT_SYNC_PLUGIN_NAME);

/** The key assigned to the plugin's token slot, or `null` when none is. */
export async function tokenKeyOf(cms: Cms): Promise<TokenKeyView | null> {
	const slots = await cms.apiKeys.slots();
	return slots.find((slot) => slot.plugin === GIT_SYNC_PLUGIN_NAME && slot.slot === GIT_SYNC_TOKEN_SLOT)?.key ?? null;
}

export async function settingsView(ctx: SyncContext): Promise<SettingsView> {
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

export async function saveSettings(ctx: SyncContext, patch: SettingsPatch): Promise<SettingsView> {
	const secrets = secretsOf(ctx);
	if (!secrets.available) {
		throw new CmsError(
			problemText({
				what: "MONTI_SECRET is not set, so a webhook secret cannot be stored",
				where: ".env.local (and the environment settings of your host), or `secret` in defineConfig",
				fix: "set it to a long random value (`openssl rand -base64 32`), restart the server, then save the secret again",
			}),
			"secret_not_configured",
		);
	}
	const current = (await ctx.state.settings.get())?.value;
	const webhookSecret =
		patch.webhookSecret === undefined
			? (current?.webhookSecret ?? null)
			: patch.webhookSecret === null || patch.webhookSecret.trim() === ""
				? null
				: secrets.encrypt(patch.webhookSecret.trim());
	const next: StoredSettings = { webhookSecret };
	await ctx.state.settings.save(next, patch.expectedVersion);
	return settingsView(ctx);
}

/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export async function readWebhookSecret(ctx: SyncContext): Promise<string | null> {
	const stored = (await ctx.state.settings.get())?.value.webhookSecret;
	return stored ? secretsOf(ctx).decrypt(stored) : null;
}

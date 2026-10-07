import { CmsError } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME } from "./options";
import type { StoredSettings } from "./state";
import type { SyncContext } from "./sync";

/**
 * The GitHub token and the secret the push webhook is signed with are set on the plugin's admin screen, never in config. They are saved in the plugin's storage
 * encrypted with the plugin's own key (`cms.secrets("git-sync")`, derived from the server config's `secret`). They are never sent back to the browser: the
 * screen only learns whether each is set (and the last four characters of the token, to tell tokens apart).
 */

/** What the admin screen learns about the saved settings. */
export interface SettingsView {
	/** Whether the server config has a `secret`: without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	readonly token: { readonly set: boolean; readonly hint: string | null; readonly readable: boolean };
	readonly webhookSecret: { readonly set: boolean; readonly readable: boolean };
	/** Version of the saved settings (0 when nothing is saved yet). Sent back when saving. */
	readonly version: number;
}

export interface SettingsPatch {
	/** A new token, `null` to forget it, absent to keep it. */
	readonly token?: string | null;
	readonly webhookSecret?: string | null;
	readonly expectedVersion: number;
}

const secretsOf = (ctx: SyncContext) => ctx.cms.secrets(GIT_SYNC_PLUGIN_NAME);

export async function settingsView(ctx: SyncContext): Promise<SettingsView> {
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

export async function saveSettings(ctx: SyncContext, patch: SettingsPatch): Promise<SettingsView> {
	const secrets = secretsOf(ctx);
	if (!secrets.available) {
		throw new CmsError(
			"MONTI_SECRET is not set, so a token cannot be stored (set MONTI_SECRET in the environment, or `secret` in the config)",
			"secret_not_configured",
		);
	}
	const current = (await ctx.state.settings.get())?.value;
	const encrypt = (value: string | null | undefined, kept: string | null | undefined): string | null =>
		value === undefined ? (kept ?? null) : value === null || value.trim() === "" ? null : secrets.encrypt(value.trim());
	const next: StoredSettings = {
		token: encrypt(patch.token, current?.token),
		webhookSecret: encrypt(patch.webhookSecret, current?.webhookSecret),
	};
	await ctx.state.settings.save(next, patch.expectedVersion);
	return settingsView(ctx);
}

/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export async function readWebhookSecret(ctx: SyncContext): Promise<string | null> {
	const stored = (await ctx.state.settings.get())?.value.webhookSecret;
	return stored ? secretsOf(ctx).decrypt(stored) : null;
}

import type { ApiKeyChoiceInput, ApiKeyView } from "@monti-cms/core/client";
import { CmsError, problemText } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME } from "./options";
import { settingsMessages } from "./settings.messages";
import type { StoredSettings } from "./state";
import type { SyncContext } from "./sync";

/**
 * The GitHub token is a key of the central API key store (`cms.apiKeys`): the plugin keeps the key's id and reads the value from the store when it calls GitHub.
 * The secret the push webhook is signed with is the plugin's own: it is set on the plugin's admin screen, never in config, and saved in the plugin's storage
 * encrypted with the plugin's own key (`cms.secrets("git-sync")`, derived from the server config's `secret`). Neither is ever sent back to the browser: the screen
 * learns the token's key by name and last four characters, and only whether the webhook secret is set.
 */

/** The key of the store the token comes from, as the admin screen shows it. */
export type TokenKeyView = Pick<ApiKeyView, "id" | "name" | "tail" | "readable">;

/** What the admin screen learns about the saved settings. */
export interface SettingsView {
	/** Whether the server config has a `secret`: without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	/** The key the token is read from, or `null` when none is chosen (or the key was deleted: that is the same as no token yet). */
	readonly token: { readonly key: TokenKeyView | null };
	readonly webhookSecret: { readonly set: boolean; readonly readable: boolean };
	/** Version of the saved settings (0 when nothing is saved yet). Sent back when saving. */
	readonly version: number;
}

export interface SettingsPatch {
	/** The key to use for the token; absent keeps the key as it is. */
	readonly token?: ApiKeyChoiceInput;
	/** A new webhook secret, `null` to forget it, absent to keep it. */
	readonly webhookSecret?: string | null;
	readonly expectedVersion: number;
}

const secretsOf = (ctx: SyncContext) => ctx.cms.secrets(GIT_SYNC_PLUGIN_NAME);

export async function settingsView(ctx: SyncContext): Promise<SettingsView> {
	const secrets = secretsOf(ctx);
	const item = await ctx.state.settings.get();
	const keyId = item?.value.tokenKeyId ?? null;
	const key = keyId ? await ctx.cms.apiKeys.get(keyId) : null;
	const webhookSecret = item?.value.webhookSecret ? secrets.decrypt(item.value.webhookSecret) : null;
	return {
		secretsAvailable: secrets.available && ctx.cms.apiKeys.available,
		token: { key: key ? { id: key.id, name: key.name, tail: key.tail, readable: key.readable } : null },
		webhookSecret: {
			set: Boolean(item?.value.webhookSecret),
			readable: !item?.value.webhookSecret || webhookSecret !== null,
		},
		version: item?.version ?? 0,
	};
}

/** Tells the key store where the token is used, so the API keys screen can list it and warn before the key is deleted. */
async function reportKeyUse(ctx: SyncContext, keyId: string | null): Promise<void> {
	const t = ctx.cms.site.createTranslator(settingsMessages);
	await ctx.cms.apiKeys.setUses(GIT_SYNC_PLUGIN_NAME, keyId ? [{ slot: "token", keyId, label: t("keyUse") }] : []);
}

export interface SavedSettings {
	readonly view: SettingsView;
	/** A key was chosen that the token did not use before: what waited for a token can go out now. */
	readonly tokenChanged: boolean;
}

export async function saveSettings(ctx: SyncContext, patch: SettingsPatch): Promise<SavedSettings> {
	const secrets = secretsOf(ctx);
	if (!secrets.available || !ctx.cms.apiKeys.available) {
		throw new CmsError(
			problemText({
				what: "MONTI_SECRET is not set, so a token cannot be stored",
				where: ".env.local (and the environment settings of your host), or `secret` in defineConfig",
				fix: "set it to a long random value (`openssl rand -base64 32`), restart the server, then save the token again",
			}),
			"secret_not_configured",
		);
	}
	const current = (await ctx.state.settings.get())?.value;
	const keptKeyId = current?.tokenKeyId ?? null;
	const keyId =
		patch.token === undefined ? keptKeyId : await ctx.cms.apiKeys.choose(patch.token, { baseName: "GitHub" });
	const webhookSecret =
		patch.webhookSecret === undefined
			? (current?.webhookSecret ?? null)
			: patch.webhookSecret === null || patch.webhookSecret.trim() === ""
				? null
				: secrets.encrypt(patch.webhookSecret.trim());
	const next: StoredSettings = { tokenKeyId: keyId, webhookSecret };
	try {
		await ctx.state.settings.save(next, patch.expectedVersion);
	} catch (error) {
		// A key that was just made from the typed value is of no use when the settings were not saved.
		if (patch.token?.use === "new" && keyId) {
			const created = await ctx.cms.apiKeys.get(keyId);
			if (created) await ctx.cms.apiKeys.remove(keyId, { expectedVersion: created.version }).catch(() => undefined);
		}
		throw error;
	}
	await reportKeyUse(ctx, keyId);
	return { view: await settingsView(ctx), tokenChanged: keyId !== null && keyId !== keptKeyId };
}

/** The saved webhook secret, or `null` when none is saved (or it cannot be read). */
export async function readWebhookSecret(ctx: SyncContext): Promise<string | null> {
	const stored = (await ctx.state.settings.get())?.value.webhookSecret;
	return stored ? secretsOf(ctx).decrypt(stored) : null;
}

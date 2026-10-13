import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
import { GIT_SYNC_PLUGIN_NAME } from "./options";
import { settingsMessages } from "./settings.messages";
import { COLLECTIONS } from "./state";

/**
 * Moves the GitHub token from the plugin's own settings (ciphertext under `cms.secrets("git-sync")`) into the central API key store, once: the settings keep the
 * id of the key, and the key is named `GitHub` (`GitHub 2` if taken), or an existing key with the same value is reused. A token that cannot be decrypted any more
 * (the server `secret` changed without `previousSecrets`) cannot be moved: it is left where it is, with a warning, and the token has to be entered again in the admin.
 * Safe to repeat: settings that hold a key id already are left alone, and a value already in the store is reused instead of added again.
 *
 * The old shape (`token`) is read only here, loosely; everything else reads the new one.
 */
export async function moveTokenToStore(storage: PluginStorage, cms: Cms): Promise<number> {
	if (!cms.apiKeys.available) return 0;
	const settings = storage.collection<Record<string, unknown>>(COLLECTIONS.settings);
	const row = await settings.get("default");
	if (!row || !("token" in row.value)) return 0;
	const { token, ...rest } = row.value;
	const oldToken = typeof token === "string" && token !== "" ? token : null;
	const hasKey = typeof rest.tokenKeyId === "string" && rest.tokenKeyId !== "";

	let keyId: string | null = hasKey ? (rest.tokenKeyId as string) : null;
	let moved = 0;
	if (!hasKey && oldToken) {
		const plain = cms.secrets(GIT_SYNC_PLUGIN_NAME).decrypt(oldToken);
		if (plain === null) {
			console.warn(
				"[git-sync] the saved GitHub token cannot be decrypted, so it was not moved to the API keys; enter it again on the Git sync screen",
			);
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
			moved = 1;
		}
	}

	try {
		await settings.set("default", { ...rest, tokenKeyId: keyId }, { expectedVersion: row.version });
	} catch (error) {
		// A save of the settings raced with this and wrote the new shape already.
		if ((error as { code?: unknown }).code === "conflict") return 0;
		throw error;
	}
	if (keyId) {
		const t = cms.site.createTranslator(settingsMessages);
		await cms.apiKeys.setUses(GIT_SYNC_PLUGIN_NAME, [{ slot: "token", keyId, label: t("keyUse") }]);
	}
	return moved;
}

/** Git sync migration. `monti db:migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly. */
export async function migrateGitSync(storage: PluginStorage, cms: Cms): Promise<void> {
	await moveTokenToStore(storage, cms);
}

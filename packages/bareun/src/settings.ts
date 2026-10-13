import type { ApiKeyChoiceInput } from "@monti-cms/core/client";
import type { Cms, PluginStorage } from "@monti-cms/core/plugin/server";
import { bareunMessages } from "./messages";
import { BAREUN_PLUGIN_NAME } from "./options";

/** What the admin shows of the key Bareun uses. The value is never part of it. */
export interface BareunSettingsView {
	readonly key: { id: string; name: string; tail: string; readable: boolean } | null;
}

interface StoredSettings {
	/** The id of a key in the central API key store, or `null` for no key. */
	keyId: string | null;
}

const COLLECTION = "settings";
const ITEM = "default";
const SLOT = "key";
const BASE_NAME = "Bareun";

const collectionOf = (storage: PluginStorage) => storage.collection<StoredSettings>(COLLECTION);

/** The id of the key Bareun uses, or `null` when none is chosen. */
export async function readKeyId(cms: Cms): Promise<string | null> {
	return (await collectionOf(cms.storage(BAREUN_PLUGIN_NAME)).get(ITEM))?.value.keyId ?? null;
}

/** The value of the key Bareun uses, for the server code that calls Bareun. `null` if none is chosen, the key was deleted, or it cannot be decrypted. */
export async function readApiKey(cms: Cms): Promise<string | null> {
	const keyId = await readKeyId(cms);
	return keyId ? (await cms.apiKeys.read(keyId))?.trim() || null : null;
}

export async function getSettingsView(cms: Cms): Promise<BareunSettingsView> {
	const keyId = await readKeyId(cms);
	const key = keyId ? await cms.apiKeys.get(keyId) : null;
	return { key: key && { id: key.id, name: key.name, tail: key.tail, readable: key.readable } };
}

/** Tells the key store where the key is used, so the API keys screen can list it and warn before it is deleted. */
async function reportKeyUse(cms: Cms, keyId: string | null): Promise<void> {
	const t = cms.site.createTranslator(bareunMessages);
	await cms.apiKeys.setUses(BAREUN_PLUGIN_NAME, keyId ? [{ slot: SLOT, keyId, label: t("keyUse") }] : []);
}

/**
 * Saves the key a form chose: a saved key, a typed one saved into the store as a new key (named "Bareun", or "Bareun 2", ... when taken), or none.
 * If the choice cannot be stored after a key was just created from the typed value, that key is removed again.
 */
export async function saveSettings(cms: Cms, choice: ApiKeyChoiceInput): Promise<BareunSettingsView> {
	const settings = collectionOf(cms.storage(BAREUN_PLUGIN_NAME));
	const current = await settings.get(ITEM);
	const keyId = await cms.apiKeys.choose(choice, { baseName: BASE_NAME });
	try {
		await settings.set(ITEM, { keyId }, { expectedVersion: current?.version ?? 0 });
	} catch (error) {
		if (choice.use === "new" && keyId) await removeKey(cms, keyId);
		throw error;
	}
	await reportKeyUse(cms, keyId);
	return getSettingsView(cms);
}

async function removeKey(cms: Cms, keyId: string): Promise<void> {
	const created = await cms.apiKeys.get(keyId);
	if (created) await cms.apiKeys.remove(keyId, { expectedVersion: created.version }).catch(() => {});
}

/**
 * Bareun used to read its key from the environment variable `BAREUN_API_KEY`. When nothing is chosen yet (no settings item at all, so a later "no key" is respected)
 * and the variable is set, saves its value as the key "Bareun" (reusing a key with the same value) and chooses it. Safe to call repeatedly.
 */
export async function adoptEnvKey(storage: PluginStorage, cms: Cms): Promise<void> {
	if (!cms.apiKeys.available) return;
	const env = process.env.BAREUN_API_KEY?.trim();
	if (!env) return;
	const settings = collectionOf(storage);
	if (await settings.get(ITEM)) return;

	let keyId: string | undefined;
	for (const key of await cms.apiKeys.list()) {
		if ((await cms.apiKeys.read(key.id)) === env) {
			keyId = key.id;
			break;
		}
	}
	const created = keyId === undefined;
	keyId ??= (await cms.apiKeys.addNamed({ baseName: BASE_NAME, value: env })).id;
	try {
		await settings.set(ITEM, { keyId }, { expectedVersion: 0 });
	} catch (error) {
		if (created) await removeKey(cms, keyId);
		// A save from the admin raced with this and chose a key already.
		if ((error as { code?: unknown }).code === "conflict") return;
		throw error;
	}
	await reportKeyUse(cms, keyId);
}

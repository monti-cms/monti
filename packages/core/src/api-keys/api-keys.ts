import { randomUUID } from "node:crypto";
import { type ApiKeyChoiceInput, type ApiKeyUse, type ApiKeyView, freeKeyName } from "../core/api-keys";
import { CmsError } from "../core/store";
import type { PluginStorage, StorageItem } from "../plugin/storage";
import type { PluginSecrets } from "../secrets";

/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (`cms.secrets("core-keys")`, derived from the server config's `secret`). A plugin that needs a key keeps the key's id, not its value, reads the value
 * on the server when it calls the service (`read`), and tells the store where it uses the key (`setUses`) so the admin can show it and warn before a delete.
 *
 * The value is never part of a view and never leaves the server.
 */

/** Name of the core's storage and secrets scope. */
export const API_KEYS_SCOPE = "core-keys";
const KEYS = "keys";
const USES = "uses";

interface StoredKey {
	name: string;
	/** Encrypted value. */
	secret: string;
	tail: string;
}

interface StoredUse {
	keyId: string;
	label: string;
}

/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value: string): string => (value.length >= 12 ? value.slice(-4) : "");

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface ApiKeys {
	/** Every key with the places that use it, by name. */
	list(): Promise<ApiKeyView[]>;
	get(id: string): Promise<ApiKeyView | null>;
	/** Whether keys can be saved (the server config has a `secret`). */
	readonly available: boolean;
	/** Saves a key under a name. A name another key has fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`. */
	add(input: { name: string; value: string }): Promise<ApiKeyView>;
	/** Saves a key under `baseName`, or `baseName 2`, `baseName 3`, ... when that name is taken. */
	addNamed(input: { baseName: string; value: string }): Promise<ApiKeyView>;
	/**
	 * Turns what a form sent for a place's key into the id to keep: the id of a saved key (which must exist), the id of a key just saved from the typed value
	 * (named `baseName`, or `baseName 2`, ... when taken), or `null` for no key.
	 */
	choose(choice: ApiKeyChoiceInput, options: { baseName: string }): Promise<string | null>;
	/** Renames and/or replaces the value. `expectedVersion` is the version read last; a different one fails with `conflict`. */
	update(id: string, input: { expectedVersion: number; name?: string; value?: string }): Promise<ApiKeyView>;
	/**
	 * Deletes a key and forgets where it was used. The plugins that used it keep its id and find no key behind it, so what used it stops working. The
	 * admin API asks for confirmation first when `uses` is not empty.
	 */
	remove(id: string, input: { expectedVersion: number }): Promise<void>;
	/** The value of a key, for the server code that calls a service with it. `null` if there is no such key or it cannot be decrypted. Never send it to a browser. */
	read(id: string): Promise<string | null>;
	/**
	 * Tells the store every place a plugin uses a key, replacing what it told before. A place that names a key that does not exist is left out. A plugin calls it
	 * whenever the places change (a connection is saved or deleted), so the list in the admin is never out of date.
	 */
	setUses(plugin: string, uses: readonly { slot: string; keyId: string; label: string }[]): Promise<void>;
}

export function createApiKeys(options: { storage: () => PluginStorage; secrets: PluginSecrets }): ApiKeys {
	const { secrets } = options;
	const keys = () => options.storage().collection<StoredKey>(KEYS);
	const uses = () => options.storage().collection<StoredUse>(USES);

	const usesByKey = async (): Promise<Map<string, ApiKeyUse[]>> => {
		const grouped = new Map<string, ApiKeyUse[]>();
		for (const item of await uses().list()) {
			const at = item.key.indexOf(":");
			const place: ApiKeyUse = { plugin: item.key.slice(0, at), slot: item.key.slice(at + 1), label: item.value.label };
			grouped.set(item.value.keyId, [...(grouped.get(item.value.keyId) ?? []), place]);
		}
		return grouped;
	};

	const view = (item: StorageItem<StoredKey>, places: ApiKeyUse[] | undefined): ApiKeyView => ({
		id: item.key,
		name: item.value.name,
		tail: item.value.tail,
		readable: secrets.decrypt(item.value.secret) !== null,
		version: item.version,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString(),
		uses: places ?? [],
	});

	const list = async (): Promise<ApiKeyView[]> => {
		const [items, places] = await Promise.all([keys().list(), usesByKey()]);
		return items
			.map((item) => view(item, places.get(item.key)))
			.sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
	};

	const assertNameFree = async (name: string, exceptId?: string) => {
		const clash = (await keys().list()).find((item) => item.key !== exceptId && sameName(item.value.name, name));
		if (clash) {
			throw new CmsError(`There is already a key named "${name}"; pick another name`, "key_name_taken");
		}
	};

	const create = async (name: string, value: string): Promise<ApiKeyView> => {
		const secret = secrets.encrypt(value);
		const item = await keys().set(randomUUID(), { name, secret, tail: tailOf(value) }, { expectedVersion: 0 });
		return view(item, []);
	};

	const api: ApiKeys = {
		list,
		get: async (id) => {
			const item = await keys().get(id);
			return item ? view(item, (await usesByKey()).get(id)) : null;
		},
		available: secrets.available,
		add: async ({ name, value }) => {
			await assertNameFree(name);
			return create(name, value);
		},
		addNamed: async ({ baseName, value }) => {
			const taken = (await keys().list()).map((item) => item.value.name);
			return create(freeKeyName(baseName, taken), value);
		},
		choose: async (choice, { baseName }) => {
			if (choice.use === "none") return null;
			if (choice.use === "saved") {
				if (!(await keys().get(choice.keyId))) {
					throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input");
				}
				return choice.keyId;
			}
			return (await api.addNamed({ baseName, value: choice.value })).id;
		},
		update: async (id, { expectedVersion, name, value }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			if (name !== undefined && !sameName(name, current.value.name)) await assertNameFree(name, id);
			const next: StoredKey = {
				name: name ?? current.value.name,
				secret: value === undefined ? current.value.secret : secrets.encrypt(value),
				tail: value === undefined ? current.value.tail : tailOf(value),
			};
			const saved = await keys().set(id, next, { expectedVersion });
			return view(saved, (await usesByKey()).get(id));
		},
		remove: async (id, { expectedVersion }) => {
			await keys().delete(id, { expectedVersion });
			for (const item of await uses().list()) {
				if (item.value.keyId === id) await uses().delete(item.key, { expectedVersion: item.version });
			}
		},
		read: async (id) => {
			const item = await keys().get(id);
			return item ? secrets.decrypt(item.value.secret) : null;
		},
		setUses: async (plugin, places) => {
			const existing = new Set((await keys().list()).map((item) => item.key));
			const wanted = new Map(
				places.filter((place) => existing.has(place.keyId)).map((place) => [`${plugin}:${place.slot}`, place]),
			);
			const current = await uses().list({ prefix: `${plugin}:` });
			for (const item of current) {
				if (!wanted.has(item.key)) await uses().delete(item.key, { expectedVersion: item.version });
			}
			const versions = new Map(current.map((item) => [item.key, item.version]));
			for (const [key, place] of wanted) {
				await uses().set(key, { keyId: place.keyId, label: place.label }, { expectedVersion: versions.get(key) ?? 0 });
			}
		},
	};
	return api;
}
